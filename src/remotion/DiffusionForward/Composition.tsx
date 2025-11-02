import React, { useMemo } from "react";
import { useCurrentFrame, useVideoConfig, interpolate } from "remotion";

export type NoiseStepParams = {
  gaussMeanX: number;
  gaussMeanY: number;
  gaussVarX: number;
  gaussVarY: number;
};

export type DDPM2DProps = {
  dist2d: "ring" | "spiral" | "sketch";
  steps: number;
  n: number;
  mode?: "light" | "dark";
  custom2D?: { xs: Float32Array; ys: Float32Array } | null;
  framesPerStep?: number;
  tailHoldFrames?: number;
  visibleCount?: number;

  // cumulative noise
  noiseMode?: boolean;
  noiseSteps?: number;
  noiseHistory?: NoiseStepParams[];

  // current controls (normal mode)
  gaussMeanX?: number;
  gaussMeanY?: number;
  gaussVarX?: number;
  gaussVarY?: number;

  noiseDisplay?: "dots" | "values";
  showNoiseOverlay?: boolean;
};

/* RNG + helpers */
const mulberry32 = (s: number) => () => {
  let t = (s += 0x6d2b79f5);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const randn = (rng: () => number) => {
  let u = 0,
    v = 0;
  while (u === 0) u = rng();
  while (v === 0) v = rng();
  const m = Math.sqrt(-2 * Math.log(u));
  return m * Math.cos(2 * Math.PI * v);
};
const randn2 = (rng: () => number): [number, number] => {
  let u = 0,
    v = 0;
  while (u === 0) u = rng();
  while (v === 0) v = rng();
  const m = Math.sqrt(-2 * Math.log(u));
  return [m * Math.cos(2 * Math.PI * v), m * Math.sin(2 * Math.PI * v)];
};

/* Datasets */
const sample2D = (n: number, dist: "ring" | "spiral", rng: () => number) => {
  const xs = new Float32Array(n);
  const ys = new Float32Array(n);
  if (dist === "ring") {
    for (let i = 0; i < n; i++) {
      const th = rng() * Math.PI * 2;
      const r = 2.2 + (rng() - 0.5) * 0.3;
      xs[i] = r * Math.cos(th);
      ys[i] = r * Math.sin(th);
    }
  } else {
    for (let i = 0; i < n; i++) {
      const a = rng() * 5.5 * Math.PI;
      const r = 0.2 + 0.15 * a;
      const [e0, e1] = randn2(rng);
      xs[i] = r * Math.cos(a) + 0.1 * e0;
      ys[i] = r * Math.sin(a) + 0.1 * e1;
    }
  }
  return { xs, ys };
};

/* ᾱ(t) for NORMAL animation only */
const makeAlphaBar = (T: number) => {
  const betaStart = 1e-4,
    betaEnd = 0.2;
  const betas = Array.from({ length: T }, (_, i) =>
    Math.min(0.999, betaStart + (i / Math.max(1, T - 1)) * (betaEnd - betaStart))
  );
  const alphas = betas.map((b) => 1 - b);
  const out: number[] = [];
  let p = 1;
  for (const a of alphas) {
    p *= a;
    out.push(p);
  }
  return out;
};

export const DDPMForwardComposition: React.FC<DDPM2DProps> = ({
  dist2d,
  steps,
  n,
  mode = "dark",
  custom2D = null,
  framesPerStep = 6,
  tailHoldFrames = 150,
  visibleCount = 400,
  noiseMode = false,
  noiseSteps = 0,
  noiseHistory = [],
  gaussMeanX = 0,
  gaussMeanY = 0,
  gaussVarX = 1,
  gaussVarY = 1,
  noiseDisplay = "dots",
  showNoiseOverlay = true,
}) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();

  const P =
    mode === "light"
      ? {
          bg: "#fff",
          frame: "#e8ecf2",
          grid: "#d9e1ec",
          dots: "#f59e0b",
          label: "#0b1324",
          axes: "#1f2937",
          legendBg: "rgba(15,23,42,.06)",
        }
      : {
          bg: "#000",
          frame: "#243145",
          grid: "#2b3a51",
          dots: "#ffd166",
          label: "#dfe9f5",
          axes: "#aac0d4",
          legendBg: "rgba(255,255,255,.06)",
        };

  // base seed for DATA ONLY — can depend on n
  const stableSeedForData =
    5678 + (dist2d === "ring" ? 202 : 0) + (steps << 3) + n * 17;
  const baseRng = useMemo(() => mulberry32(stableSeedForData >>> 0), [stableSeedForData]);

  // base data distribution (2d)
  const base = useMemo(() => {
    if (dist2d === "sketch" && custom2D && custom2D.xs.length) {
      return { x: custom2D.xs, y: custom2D.ys };
    }
    const s2 = sample2D(n, dist2d === "ring" ? "ring" : "spiral", baseRng);
    return { x: s2.xs, y: s2.ys };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dist2d, n, baseRng, custom2D]);

  // eps for normal animation — uses current controls
  const epsSeed = 0x9e3779b9 ^ 123456;
  const epsRng = useMemo(() => mulberry32(epsSeed >>> 0), [epsSeed]);
  const eps = useMemo(() => {
    const len = (base.x as Float32Array).length;
    const ex = new Float32Array(len);
    const ey = new Float32Array(len);
    const stdX = Math.sqrt(Math.max(1e-8, gaussVarX));
    const stdY = Math.sqrt(Math.max(1e-8, gaussVarY));
    for (let i = 0; i < len; i++) {
      ex[i] = gaussMeanX + stdX * randn(epsRng);
      ey[i] = gaussMeanY + stdY * randn(epsRng);
    }
    return { ex, ey };
  }, [base, epsRng, gaussMeanX, gaussMeanY, gaussVarX, gaussVarY]);

  // schedule for NORMAL animation
  const alphaBar = useMemo(() => makeAlphaBar(Math.max(2, steps)), [steps]);
  const activeFrames = Math.max(1, steps * framesPerStep);
  const tail = Math.max(0, tailHoldFrames);

  const f = Math.min(frame, activeFrames - 1);
  const tPos = interpolate(
    f,
    [0, Math.max(1, activeFrames - 1)],
    [0, Math.max(1, steps - 1)],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );
  const k = Math.max(0, Math.min(steps - 2, Math.floor(tPos)));
  const frac = Math.max(0, Math.min(1, tPos - k));
  const ab = alphaBar[k] + (alphaBar[k + 1] - alphaBar[k]) * frac;
  const s1 = Math.sqrt(Math.max(1e-8, ab));
  const s2 = Math.sqrt(Math.max(0, 1 - ab));

  /* layout */
  const mTop = 90;
  const mSide = 64;
  const panelHeight = 95;
  const needsBottom =
    noiseMode && showNoiseOverlay && noiseDisplay === "values";
  const mBot = needsBottom ? panelHeight + 20 : 64;
  const plotW = width - mSide * 2;
  const plotH = height - mTop - mBot;
  const cx = width / 2;
  const cy = mTop + plotH / 2;

  const F = {
    titleMain: 30,
    title: 22,
    subtitle: 18,
  };

  const xyMin = -5,
    xyMax = 5;
  const xyToPx = (x: number, y: number): [number, number] => {
    const px = mSide + ((x - xyMin) / (xyMax - xyMin)) * plotW;
    const py = mTop + plotH - ((y - xyMin) / (xyMax - xyMin)) * plotH;
    return [px, py];
  };

  const TopRow = () => {
    const titleY = 38;
    const metaY1 = titleY - 8;
    const metaY2 = titleY + 16;

    let sub: string;
    if (noiseMode) {
      sub = `cumulative forward: ${noiseHistory.length} step(s)`;
    } else {
      sub = `step ${Math.round(tPos) + 1}/${steps} • ᾱ≈${ab.toFixed(6)}`;
    }

    return (
      <>
        <text
          x={width / 2}
          y={titleY}
          fill={P.label}
          fontSize={F.titleMain}
          fontWeight={800}
          textAnchor="middle"
        >
          Forward diffusion (2D)
        </text>
        <text x={16} y={metaY1} fill={P.label} fontSize={F.title} fontWeight={700}>
          {`2D — ${dist2d}`}
        </text>
        <text x={16} y={metaY2} fill={P.label} fontSize={F.subtitle} opacity={0.9}>
          {sub}
        </text>
      </>
    );
  };

  // ====================== NOISE MODE (cumulative, convex toward mean) ======================
  if (noiseMode) {
    const baseX = base.x as Float32Array;
    const baseY = base.y as Float32Array;
    const len = baseX.length;
    const count = Math.min(visibleCount, len);

    // start from base data
    let curX = new Float32Array(baseX);
    let curY = new Float32Array(baseY);

    // seed for noise steps — independent of n
    const baseNoiseSeed =
      911_000_123 + (dist2d === "ring" ? 17 : 31) + (steps << 1);

    // we'll store last applied noise term for display
    let lastEpsX = new Float32Array(count);
    let lastEpsY = new Float32Array(count);

    // how strongly we move toward the user-selected mean per click
    const shiftFrac = 0.3; // 30% toward mean
    // how much random jitter (relative to std) we add
    const noiseFrac = 0.35;

    for (let s = 0; s < noiseHistory.length; s++) {
      const stepParams = noiseHistory[s];
      const targetMx = stepParams.gaussMeanX;
      const targetMy = stepParams.gaussMeanY;
      const stdX = Math.sqrt(Math.max(1e-8, stepParams.gaussVarX));
      const stdY = Math.sqrt(Math.max(1e-8, stepParams.gaussVarY));

      // per-step rng, independent of n
      const rngStep = mulberry32((baseNoiseSeed + s * 101_003) >>> 0);

      for (let i = 0; i < len; i++) {
        // random jitters
        const jitterX = stdX * randn(rngStep);
        const jitterY = stdY * randn(rngStep);

        // move some fraction toward the mean
        const towardX = shiftFrac * (targetMx - curX[i]);
        const towardY = shiftFrac * (targetMy - curY[i]);

        // add small noise based on current variance
        const applyNoiseX = noiseFrac * jitterX;
        const applyNoiseY = noiseFrac * jitterY;

        curX[i] = curX[i] + towardX + applyNoiseX;
        curY[i] = curY[i] + towardY + applyNoiseY;

        if (i < count && s === noiseHistory.length - 1) {
          // show what we actually applied
          lastEpsX[i] = applyNoiseX;
          lastEpsY[i] = applyNoiseY;
        }
      }
    }

    // render transformed data dots
    const dots: JSX.Element[] = [];
    const stride = Math.max(1, Math.floor(len / count));
    let written = 0;
    for (let i = 0; i < len && written < count; i += stride, written++) {
      const [px, py] = xyToPx(curX[i], curY[i]);
      dots.push(
        <circle key={i} cx={px} cy={py} r={2.4} fill={P.dots} fillOpacity={0.95} />
      );
    }

    // axes + ticks
    const ticks = 8;
    const xtEls: JSX.Element[] = [];
    const ytEls: JSX.Element[] = [];
    for (let i = 0; i <= ticks; i++) {
      const v = xyMin + (i / ticks) * (xyMax - xyMin);
      const [px0] = xyToPx(v, 0);
      const [, py1] = xyToPx(0, v);
      xtEls.push(
        <line
          key={`xt-${i}`}
          x1={px0}
          y1={mTop + plotH}
          x2={px0}
          y2={mTop + plotH + 6}
          stroke={P.axes}
          opacity={0.6}
        />
      );
      xtEls.push(
        <text
          key={`xl-${i}`}
          x={px0}
          y={mTop + plotH + 24}
          fill={P.label}
          fontSize={14}
          textAnchor="middle"
        >
          {Math.round(v * 10) / 10}
        </text>
      );
      ytEls.push(
        <line
          key={`yt-${i}`}
          x1={mSide - 6}
          y1={py1}
          x2={mSide}
          y2={py1}
          stroke={P.axes}
          opacity={0.6}
        />
      );
      ytEls.push(
        <text
          key={`yl-${i}`}
          x={mSide - 10}
          y={py1 + 5}
          fill={P.label}
          fontSize={14}
          textAnchor="end"
        >
          {Math.round(v * 10) / 10}
        </text>
      );
    }

    // bottom values panel
    let bottomPanel: JSX.Element | null = null;
    if (showNoiseOverlay && noiseDisplay === "values" && noiseHistory.length > 0) {
      const maxShow = Math.min(count, 40);
      const cellW = 150;
      const cols = Math.max(1, Math.floor(plotW / cellW));
      const startY = height - panelHeight + 30;

      bottomPanel = (
        <g>
          <rect
            x={mSide - 1}
            y={height - panelHeight - 10}
            width={plotW + 2}
            height={panelHeight}
            rx={10}
            fill={P.legendBg}
          />
          <text
            x={mSide + 12}
            y={height - panelHeight + 12}
            fill={P.label}
            fontSize={14}
            fontWeight={700}
          >
            Last step (applied) noise — first {maxShow} points
          </text>
          {Array.from({ length: maxShow }).map((_, idx) => {
            const r = Math.floor(idx / cols);
            const c = idx % cols;
            const x = mSide + 12 + c * cellW;
            const y = startY + r * 18;
            return (
              <text key={idx} x={x} y={y} fill={P.label} fontSize={12}>
                #{idx + 1}: ({lastEpsX[idx].toFixed(3)}, {lastEpsY[idx].toFixed(3)})
              </text>
            );
          })}
        </g>
      );
    }

    // noise as dots overlay
    let noiseDotsLayer: JSX.Element | null = null;
    if (showNoiseOverlay && noiseDisplay === "dots") {
      const ndots: JSX.Element[] = [];
      const stride2 = Math.max(1, Math.floor(len / count));
      let written2 = 0;
      for (let i = 0; i < len && written2 < count; i += stride2, written2++) {
        const [px, py] = xyToPx(curX[i], curY[i]);
        ndots.push(
          <circle
            key={`nd-${i}`}
            cx={px}
            cy={py}
            r={3.2}
            fill={P.label}
            fillOpacity={0.12}
          />
        );
      }
      noiseDotsLayer = <>{ndots}</>;
    }

    return (
      <svg width={width} height={height} style={{ background: P.bg }}>
        <TopRow />
        <rect
          x={mSide - 1}
          y={mTop - 1}
          width={plotW + 2}
          height={plotH + 2}
          fill={P.bg}
          stroke={P.frame}
        />
        <line
          x1={mSide}
          y1={mTop + plotH}
          x2={mSide + plotW}
          y2={mTop + plotH}
          stroke={P.grid}
        />

        {dots}
        {noiseDotsLayer}

        <line x1={mSide} y1={cy} x2={mSide + plotW} y2={cy} stroke={P.axes} />
        <line x1={cx} y1={mTop} x2={cx} y2={mTop + plotH} stroke={P.axes} />
        {xtEls}
        {ytEls}

        {bottomPanel}
      </svg>
    );
  }

  // ========================= normal animation =========================
  const x0 = base.x as Float32Array;
  const y0 = base.y as Float32Array;
  const ex = eps.ex as Float32Array;
  const ey = eps.ey as Float32Array;

  const dots: JSX.Element[] = [];
  const count = Math.min(visibleCount, x0.length);
  const stride = Math.max(1, Math.floor(x0.length / count));
  let written = 0;
  for (let i = 0; i < x0.length && written < count; i += stride, written++) {
    const xt = s1 * x0[i] + s2 * ex[i];
    const yt = s1 * y0[i] + s2 * ey[i];
    const [px, py] = xyToPx(xt, yt);
    dots.push(<circle key={i} cx={px} cy={py} r={2.2} fill={P.dots} fillOpacity={0.95} />);
  }

  const ticks = 8;
  const xtEls: JSX.Element[] = [];
  const ytEls: JSX.Element[] = [];
  for (let i = 0; i <= ticks; i++) {
    const v = xyMin + (i / ticks) * (xyMax - xyMin);
    const [px0] = xyToPx(v, 0);
    const [, py1] = xyToPx(0, v);
    xtEls.push(
      <line
        key={`xt-${i}`}
        x1={px0}
        y1={mTop + plotH}
        x2={px0}
        y2={mTop + plotH + 6}
        stroke={P.axes}
        opacity={0.6}
      />
    );
    xtEls.push(
      <text
        key={`xl-${i}`}
        x={px0}
        y={mTop + plotH + 24}
        fill={P.label}
        fontSize={14}
        textAnchor="middle"
      >
        {Math.round(v * 10) / 10}
      </text>
    );
    ytEls.push(
      <line
        key={`yt-${i}`}
        x1={mSide - 6}
        y1={py1}
        x2={mSide}
        y2={py1}
        stroke={P.axes}
        opacity={0.6}
      />
    );
    ytEls.push(
      <text
        key={`yl-${i}`}
        x={mSide - 10}
        y={py1 + 5}
        fill={P.label}
        fontSize={14}
        textAnchor="end"
      >
        {Math.round(v * 10) / 10}
      </text>
    );
  }

  return (
    <svg width={width} height={height} style={{ background: P.bg }}>
      <TopRow />
      <rect
        x={mSide - 1}
        y={mTop - 1}
        width={plotW + 2}
        height={plotH + 2}
        fill={P.bg}
        stroke={P.frame}
      />
      <line
        x1={mSide}
        y1={mTop + plotH}
        x2={mSide + plotW}
        y2={mTop + plotH}
        stroke={P.grid}
      />
      {dots}
      <line x1={mSide} y1={cy} x2={mSide + plotW} y2={cy} stroke={P.axes} />
      <line x1={cx} y1={mTop} x2={cx} y2={mTop + plotH} stroke={P.axes} />
      {xtEls}
      {ytEls}
    </svg>
  );
};