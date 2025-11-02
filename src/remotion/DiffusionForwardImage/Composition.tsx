import React, { useEffect, useMemo, useRef, useState } from "react";
import { useCurrentFrame, useVideoConfig, interpolate } from "remotion";
import sampleImage from "../../_static/tiger.jpg";

export type ImageForwardProps = {
  imageUrl?: string;
  steps: number;
  mode?: "light" | "dark";
  framesPerStep?: number;
  tailHoldFrames?: number;
  internalSize?: number;
};

const mulberry32 = (s: number) => () => {
  let t = (s += 0x6d2b79f5);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const randn = (rng: () => number) => {
  let u = 0, v = 0;
  while (u === 0) u = rng();
  while (v === 0) v = rng();
  const m = Math.sqrt(-2 * Math.log(u));
  return m * Math.cos(2 * Math.PI * v);
};

const makeAlphaBar = (T: number) => {
  const betaStart = 1e-4, betaEnd = 0.2;
  const betas = Array.from({ length: T }, (_, i) =>
    Math.min(0.999, betaStart + (i / Math.max(1, T - 1)) * (betaEnd - betaStart))
  );
  const alphas = betas.map((b) => 1 - b);
  const out: number[] = [];
  let p = 1;
  for (const a of alphas) { p *= a; out.push(p); }
  return out;
};

const drawCoverToSquare = (
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  size: number
) => {
  const iw = img.naturalWidth || img.width;
  const ih = img.naturalHeight || img.height;
  const s = size;
  const scale = Math.max(s / iw, s / ih);
  const w = iw * scale;
  const h = ih * scale;
  const dx = (s - w) / 2;
  const dy = (s - h) / 2;
  ctx.clearRect(0, 0, s, s);
  ctx.drawImage(img, dx, dy, w, h);
};

export const ImageForwardComposition: React.FC<ImageForwardProps> = ({
  imageUrl,
  steps,
  mode = "dark",
  framesPerStep = 6,
  tailHoldFrames = 120,
  internalSize = 512,
}) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();

  const P =
    mode === "light"
      ? { bg:"#fff", frame:"#e8ecf2", grid:"#d9e1ec", label:"#0b1324" }
      : { bg:"#000", frame:"#243145", grid:"#2b3a51", label:"#dfe9f5" };

  // Layout (same as your version)
  const mTop = 110;
  const mSide = 48;
  const gap = 24;
  const mBot = 48;

  const availableW = width - 2 * mSide - gap;
  const sq = Math.min(availableW / 2, height - mTop - mBot);

  const leftX = mSide;
  const rightX = mSide + sq + gap;
  const topY = mTop;

  const titleY = 34;
  const subY = 56;

  // Load image
  const [imgEl, setImgEl] = useState<HTMLImageElement | null>(null);
  useEffect(() => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.decoding = "async";
    img.src = imageUrl && imageUrl.trim().length ? imageUrl : sampleImage;
    const onLoad = () => setImgEl(img);
    const onError = () => setImgEl(null);
    img.addEventListener("load", onLoad);
    img.addEventListener("error", onError);
    return () => {
      img.removeEventListener("load", onLoad);
      img.removeEventListener("error", onError);
    };
  }, [imageUrl]);

  // Base pixels (0..1)
  const [basePx, setBasePx] = useState<Float32Array | null>(null);
  useEffect(() => {
    if (!imgEl) return;
    const s = internalSize;
    const off = document.createElement("canvas");
    off.width = s; off.height = s;
    const ctx = off.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;

    drawCoverToSquare(ctx, imgEl, s);
    const data = ctx.getImageData(0, 0, s, s).data;
    const arr = new Float32Array(s * s * 3);
    for (let i = 0, j = 0; i < data.length; i += 4, j += 3) {
      arr[j + 0] = data[i + 0] / 255;
      arr[j + 1] = data[i + 1] / 255;
      arr[j + 2] = data[i + 2] / 255;
    }
    setBasePx(arr);
  }, [imgEl, internalSize]);

  // Fixed noise (same ε for forward & reverse)
  const noise = useMemo(() => {
    if (!basePx) return null;
    const rng = mulberry32(0xdecafbad);
    const e = new Float32Array(basePx.length);
    for (let i = 0; i < e.length; i++) e[i] = randn(rng);
    return e;
  }, [basePx]);

  // Schedule + timing
  const alphaBar = useMemo(() => makeAlphaBar(Math.max(2, steps)), [steps]);
  const activeFrames = Math.max(1, steps * framesPerStep);
  const totalFrames = activeFrames + Math.max(0, tailHoldFrames);

  // progress in [0,1]
  const progress = activeFrames > 1 ? Math.min(frame, activeFrames - 1) / (activeFrames - 1) : 0;

  // Split 50/50: forward then reverse using SAME ε
  const firstHalf = progress <= 0.5;
  const local = firstHalf ? progress * 2 : (1 - progress) * 2; // both map to [0..1]
  const tPos = interpolate(
    local,
    [0, 1],
    [0, Math.max(1, steps - 1)],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );
  const k = Math.max(0, Math.min(steps - 2, Math.floor(tPos)));
  const frac = Math.max(0, Math.min(1, tPos - k));
  const ab = alphaBar[k] + (alphaBar[k + 1] - alphaBar[k]) * frac;

  const s1 = Math.sqrt(Math.max(1e-8, ab));
  const s2 = Math.sqrt(Math.max(0, 1 - ab));

  // Canvases
  const leftRef = useRef<HTMLCanvasElement | null>(null);
  const rightRef = useRef<HTMLCanvasElement | null>(null);

  // Left: original
  useEffect(() => {
    if (!imgEl) return;
    const c = leftRef.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    c.width = Math.round(sq * dpr);
    c.height = Math.round(sq * dpr);
    c.style.width = `${sq}px`;
    c.style.height = `${sq}px`;
    ctx.save();
    ctx.scale(dpr, dpr);
    drawCoverToSquare(ctx, imgEl, sq);
    ctx.restore();
  }, [imgEl, sq]);

  // Right: forward (first half) → denoise (second half), SAME ε
  useEffect(() => {
    if (!basePx || !noise) return;
    const c = rightRef.current;
    if (!c) return;
    const ctx = c.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;

    const s = internalSize;
    const off = document.createElement("canvas");
    off.width = s; off.height = s;
    const octx = off.getContext("2d");
    if (!octx) return;

    const imgData = octx.createImageData(s, s);
    const out = imgData.data;

    for (let i = 0, j = 0; i < basePx.length; i += 3, j += 4) {
      // x_t = sqrt(ab)*x0 + sqrt(1-ab)*eps
      const r = s1 * basePx[i + 0] + s2 * noise[i + 0];
      const g = s1 * basePx[i + 1] + s2 * noise[i + 1];
      const b = s1 * basePx[i + 2] + s2 * noise[i + 2];
      out[j + 0] = Math.max(0, Math.min(255, Math.round(r * 255)));
      out[j + 1] = Math.max(0, Math.min(255, Math.round(g * 255)));
      out[j + 2] = Math.max(0, Math.min(255, Math.round(b * 255)));
      out[j + 3] = 255;
    }
    octx.putImageData(imgData, 0, 0);

    const dpr = window.devicePixelRatio || 1;
    c.width = Math.round(sq * dpr);
    c.height = Math.round(sq * dpr);
    c.style.width = `${sq}px`;
    c.style.height = `${sq}px`;

    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.drawImage(off, 0, 0, sq, sq);
    ctx.restore();
  }, [basePx, noise, sq, s1, s2, internalSize, frame]);

  const phase = firstHalf ? "noising" : "denoising";
  const tDisp = Math.round(tPos) + 1;
  const title = "Forward diffusion + Denoising (same ε)";
  const sub = `${phase} • t=${tDisp}/${steps} • ᾱ≈${ab.toFixed(6)}`;

  return (
    <svg width={width} height={height} style={{ background: P.bg }}>
      {/* Title row */}
      <text x={width / 2} y={titleY} fill={P.label} fontSize={28} fontWeight={800} textAnchor="middle">
        {title}
      </text>
      <text x={width / 2} y={subY + 10} fill={P.label} fontSize={18} opacity={0.9} textAnchor="middle">
        {sub}
      </text>

      {/* Frames */}
      <rect x={leftX - 1} y={topY - 1} width={sq + 2} height={sq + 2} fill="none" stroke={P.frame} />
      <rect x={rightX - 1} y={topY - 1} width={sq + 2} height={sq + 2} fill="none" stroke={P.frame} />

      {/* Labels */}
      <text x={leftX} y={topY - 12} fill={P.label} fontSize={16} fontWeight={700}>
        Input (cropped square)
      </text>
      <text x={rightX} y={topY - 12} fill={P.label} fontSize={16} fontWeight={700}>
        Forward → Denoise (same ε)
      </text>

      {/* Canvases */}
      <foreignObject x={leftX} y={topY} width={sq} height={sq}>
        <canvas ref={leftRef} style={{ display: "block", width: "100%", height: "100%" }} />
      </foreignObject>
      <foreignObject x={rightX} y={topY} width={sq} height={sq}>
        <canvas ref={rightRef} style={{ display: "block", width: "100%", height: "100%" }} />
      </foreignObject>

      {/* Bottom note */}
      <text
        x={width / 2}
        y={height - 25}
        fill={P.label}
        fontSize={14}
        opacity={0.85}
        textAnchor="middle"
      >
        xₜ = √ᾱₜ · x₀ + √(1−ᾱₜ) · ε — first half noising, second half denoising with the same ε.
      </text>
    </svg>
  );
};
