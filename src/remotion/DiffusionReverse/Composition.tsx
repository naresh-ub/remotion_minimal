import React, { useMemo } from "react";
import { useCurrentFrame, useVideoConfig, interpolate } from "remotion";

export type DDPMReverseProps = {
  dim: "1d" | "2d";
  dist1d: "uniform" | "spiky" | "sketch";
  dist2d: "ring" | "spiral" | "sketch";
  steps: number;
  n: number;
  showTarget?: boolean;
  showStartNoise?: boolean;
  custom1D?: Float32Array | null;
  custom2D?: { xs: Float32Array; ys: Float32Array } | null;
  mode?: "light" | "dark";
  /** pacing + end hold **/
  framesPerStep?: number;      // default 6
  tailHoldFrames?: number;     // default 120
};

/* RNG + helpers */
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
const randn2 = (rng: () => number): [number, number] => {
  let u = 0, v = 0;
  while (u === 0) u = rng();
  while (v === 0) v = rng();
  const m = Math.sqrt(-2 * Math.log(u));
  return [m * Math.cos(2 * Math.PI * v), m * Math.sin(2 * Math.PI * v)];
};

/* Base datasets */
const sample1D = (n: number, dist: "uniform" | "spiky", rng: () => number) => {
  const out = new Float32Array(n);
  if (dist === "uniform") {
    for (let i = 0; i < n; i++) out[i] = (rng() * 2 - 1) * 4;
  } else {
    for (let i = 0; i < n; i++) {
      const k = Math.floor(rng() * 7) - 3;
      out[i] = k + 0.15 * randn(rng);
    }
  }
  return out;
};
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

/* ᾱ(t) */
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

/* KDE for 1D density */
const kde = (data: Float32Array, grid: number[]) => {
  const n = data.length || 1;
  let mean = 0; for (let i = 0; i < n; i++) mean += data[i]; mean /= n;
  let v = 0; for (let i = 0; i < n; i++) { const d = data[i] - mean; v += d * d; }
  v = v / Math.max(1, n - 1);
  const std = Math.sqrt(Math.max(1e-6, v));
  const h = 1.06 * std * Math.pow(n, -1 / 5);
  const inv = 1 / (Math.sqrt(2 * Math.PI) * h * n);
  const ys = new Array(grid.length).fill(0);
  for (let j = 0; j < grid.length; j++) {
    const x = grid[j];
    let s = 0;
    for (let i = 0; i < n; i++) {
      const z = (x - data[i]) / h;
      s += Math.exp(-0.5 * z * z);
    }
    ys[j] = inv * s;
  }
  return ys;
};

export const DDPMReverseComposition: React.FC<DDPMReverseProps> = ({
  dim,
  dist1d,
  dist2d,
  steps,
  n,
  showTarget = true,
  showStartNoise = true,
  custom1D = null,
  custom2D = null,
  mode = "dark",
  framesPerStep = 6,
  tailHoldFrames = 120,
}) => {
  const frame = useCurrentFrame();
  const { width, height, durationInFrames } = useVideoConfig();

  const P =
    mode === "light"
      ? { bg:"#fff", frame:"#e8ecf2", grid:"#d9e1ec", line:"#0ea5e9", dots:"#f59e0b",
          target:"#111", label:"#0b1324", axes:"#1f2937", ghost:"#94a3b8", legendBg:"rgba(15,23,42,.06)" }
      : { bg:"#000", frame:"#243145", grid:"#2b3a51", line:"#67e8f9", dots:"#ffd166",
          target:"#fff", label:"#dfe9f5", axes:"#aac0d4", ghost:"#6b7d97", legendBg:"rgba(255,255,255,.06)" };

  // Base x0
  const baseSeed =
    (dim === "1d" ? 8081 : 9092) + n * 7 + (steps << 2) +
    (dist1d === "spiky" ? 100 : 0) + (dist2d === "ring" ? 200 : 0);
  const baseRng = useMemo(() => mulberry32(baseSeed >>> 0), [baseSeed]);

  const base = useMemo(() => {
    if (dim === "1d") {
      if (dist1d === "sketch" && custom1D && custom1D.length) return { x: custom1D };
      return { x: sample1D(n, dist1d === "spiky" ? "spiky" : "uniform", baseRng) };
    } else {
      if (dist2d === "sketch" && custom2D && custom2D.xs.length) return { x: custom2D.xs, y: custom2D.ys };
      const s2 = sample2D(n, dist2d === "ring" ? "ring" : "spiral", baseRng);
      return { x: s2.xs, y: s2.ys };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dim, dist1d, dist2d, n, baseRng, custom1D, custom2D]);

  // Fixed ε per point
  const epsSeed = baseSeed ^ 0x9e3779b9;
  const epsRng = useMemo(() => mulberry32(epsSeed >>> 0), [epsSeed]);
  const eps = useMemo(() => {
    if (dim === "1d") {
      const e = new Float32Array((base.x as Float32Array).length);
      for (let i = 0; i < e.length; i++) e[i] = randn(epsRng);
      return { ex: e };
    } else {
      const len = (base.x as Float32Array).length;
      const ex = new Float32Array(len);
      const ey = new Float32Array(len);
      for (let i = 0; i < len; i++) {
        const [a, b] = randn2(epsRng);
        ex[i] = a; ey[i] = b;
      }
      return { ex, ey };
    }
  }, [dim, base, epsRng]);

  // schedule + reverse timeline with tail hold
  const alphaBar = useMemo(() => makeAlphaBar(Math.max(2, steps)), [steps]);
  const activeFrames = Math.max(1, steps * framesPerStep);
  const tail = Math.max(0, tailHoldFrames);
  const totalFrames = activeFrames + tail;

  const f = Math.min(frame, activeFrames - 1); // clamp during tail
  const tPosFwd = interpolate(
    f, [0, Math.max(1, activeFrames - 1)], [0, Math.max(1, steps - 1)],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );
  const tPosRev = (steps - 1) - tPosFwd;
  const k = Math.max(0, Math.min(steps - 2, Math.floor(tPosRev)));
  const frac = Math.max(0, Math.min(1, tPosRev - k));
  const ab = alphaBar[k] + (alphaBar[k + 1] - alphaBar[k]) * frac;
  const s1 = Math.sqrt(Math.max(1e-8, ab));
  const s2 = Math.sqrt(Math.max(0, 1 - ab));

  /* Layout */
  const mTop = 100, mSide = 64, mBot = 64;
  const plotW = width - mSide * 2;
  const plotH = height - mTop - mBot;
  const cx = width / 2, cy = mTop + plotH / 2;

  const F = { titleMain: 30, title: 22, subtitle: 18, axis: 22, ticks: 14, legend: 16 };

  /* Axes helpers */
  const xMin = -5, xMax = 5;
  const xToPx = (x: number) => mSide + ((x - xMin) / (xMax - xMin)) * plotW;

  const xyMin = -5, xyMax = 5;
  const xyToPx = (x: number, y: number): [number, number] => {
    const px = mSide + ((x - xyMin) / (xyMax - xyMin)) * plotW;
    const py = mTop + plotH - ((y - xyMin) / (xyMax - xyMin)) * plotH;
    return [px, py];
  };

  /* Text */
  const header = `${dim.toUpperCase()} — ${dim === "1d" ? dist1d : dist2d}`;
  const sub = `reverse step ≈ ${Math.round(tPosRev) + 1}/${steps} • ᾱ≈${ab.toFixed(6)}`;

  /* Legend (top-right) */
  const Legend = () => {
    const LEG_W = dim === "1d" ? 380 : 260;
    const LEG_H = dim === "1d" ? 74 : 46;
    const PAD = 16;
    const xStart = width - PAD - LEG_W;
    const yStart = 38 - LEG_H / 2;
    return (
      <g transform={`translate(${xStart},${yStart})`}>
        <rect width={LEG_W} height={LEG_H} rx="10" fill={P.legendBg} />
        {/* current KDE / samples */}
        {dim === "1d" ? (
          <>
            <line x1="14" y1="20" x2="74" y2="20" stroke={P.line} strokeWidth={3.5} />
            <text x="88" y="24" fill={P.label} fontSize={F.legend}>Current density (KDE)</text>
            {showTarget && (
              <>
                <line x1="14" y1="40" x2="74" y2="40" stroke={P.target} strokeWidth={2.5} strokeDasharray="5 7" />
                <text x="88" y="44" fill={P.label} fontSize={F.legend}>Target density</text>
              </>
            )}
            {showStartNoise && (
              <>
                <circle cx="14" cy="60" r="4" fill={P.ghost} />
                <text x="28" y="64" fill={P.label} fontSize={F.legend}>
                  Start noise x<tspan dy={2} fontSize={F.legend - 4}>T</tspan>
                </text>
              </>
            )}
          </>
        ) : (
          <>
            <circle cx="18" cy="22" r="4" fill={P.dots} />
            <text x="34" y="26" fill={P.label} fontSize={F.legend}>
              Samples x<tspan dy={2} fontSize={F.legend - 4}>t</tspan>
            </text>
          </>
        )}
      </g>
    );
  };

  const drawXTicks = (ticks = 10) => {
    const els: JSX.Element[] = [];
    for (let i = 0; i <= ticks; i++) {
      const x = xMin + (i / ticks) * (xMax - xMin);
      const px = xToPx(x);
      els.push(<line key={i} x1={px} y1={mTop + plotH} x2={px} y2={mTop + plotH + 6} stroke={P.axes} opacity={0.6} />);
      els.push(<text key={`lab-${i}`} x={px} y={mTop + plotH + 24} fill={P.label} fontSize={F.ticks} textAnchor="middle">{Math.round(x * 10) / 10}</text>);
    }
    return els;
  };

  return (
    <svg width={width} height={height} style={{ background: P.bg }}>
      {/* Title row */}
      <text x={width / 2} y={38} fill={P.label} fontSize={F.titleMain} fontWeight={800} textAnchor="middle">
        Reverse diffusion (DDPM — oracle)
      </text>
      <text x={16} y={30} fill={P.label} fontSize={F.title} fontWeight={700}>
        {header}
      </text>
      <text x={16} y={54} fill={P.label} fontSize={F.subtitle} opacity={0.9}>
        {sub}
      </text>
      <Legend />

      {/* Plot frame */}
      <rect x={mSide - 1} y={mTop - 1} width={plotW + 2} height={plotH + 2} fill={P.bg} stroke={P.frame} />
      <line x1={mSide} y1={mTop + plotH} x2={mSide + plotW} y2={mTop + plotH} stroke={P.grid} />

      {dim === "1d" ? (
        (() => {
          const x0 = base.x as Float32Array;
          // current xt
          const xt = new Float32Array(x0.length);
          for (let i = 0; i < x0.length; i++) {
            xt[i] = s1 * x0[i] + s2 * (eps.ex as Float32Array)[i];
          }

          // --- FIX: draw KDE for CURRENT xt ---
          const xs = Array.from({ length: 260 }, (_, j) => xMin + (j / 259) * (xMax - xMin));
          const densXt = kde(xt, xs);
          const maxXt = densXt.reduce((m, v) => (v > m ? v : m), 1e-6);
          const pathXt = xs.map((x, i) => {
            const px = xToPx(x);
            const py = mTop + plotH - (densXt[i] / maxXt) * plotH;
            return `${i === 0 ? "M" : "L"} ${px} ${py}`;
          }).join(" ");

          // target overlay
          let targetPath = "";
          if (showTarget) {
            const dens0 = kde(x0, xs);
            const max0 = dens0.reduce((m, v) => (v > m ? v : m), 1e-6);
            targetPath = xs.map((x, i) => {
              const px = xToPx(x);
              const py = mTop + plotH - (dens0[i] / max0) * plotH;
              return `${i === 0 ? "M" : "L"} ${px} ${py}`;
            }).join(" ");
          }

          // dots for current samples
          const dots: JSX.Element[] = [];
          const step = Math.max(1, Math.floor(xt.length / 900));
          for (let i = 0; i < xt.length; i += step) {
            const px = xToPx(Math.max(xMin, Math.min(xMax, xt[i])));
            const py = mTop + plotH - 6;
            dots.push(<circle key={i} cx={px} cy={py} r={2.6} fill={P.dots} fillOpacity={0.95} />);
          }

          // start-noise overlay as faint band
          const ghostDots: JSX.Element[] = [];
          if (showStartNoise) {
            const stepG = Math.max(1, Math.floor(x0.length / 700));
            for (let i = 0; i < x0.length; i += stepG) {
              const px = xToPx(Math.max(xMin, Math.min(xMax, (eps.ex as Float32Array)[i])));
              const py = mTop + plotH - 6;
              ghostDots.push(<circle key={`g${i}`} cx={px} cy={py} r={2.0} fill={P.ghost} fillOpacity={0.7} />);
            }
          }

          return (
            <>
              {showTarget && <path d={targetPath} stroke={P.target} strokeWidth={2.5} fill="none" strokeDasharray="5 7" opacity={0.9} />}
              <path d={pathXt} stroke={P.line} strokeWidth={3.5} fill="none" />
              {ghostDots}
              {dots}
              {drawXTicks(10)}
              <text x={width / 2} y={height - 16} fill={P.label} fontSize={22} textAnchor="middle">x (1D)</text>
            </>
          );
        })()
      ) : (
        (() => {
          const x0 = base.x as Float32Array, y0 = base.y as Float32Array;
          const ex = eps.ex as Float32Array, ey = eps.ey as Float32Array;

          const pts: JSX.Element[] = [];
          for (let i = 0; i < x0.length; i++) {
            const xt = s1 * x0[i] + s2 * ex[i];
            const yt = s1 * y0[i] + s2 * ey[i];
            const [px, py] = xyToPx(xt, yt);
            pts.push(<circle key={i} cx={px} cy={py} r={2.2} fill={P.dots} fillOpacity={0.95} />);
          }

          // overlays
          const ghosts: JSX.Element[] = [];
          if (showStartNoise) {
            const stepG = Math.max(1, Math.floor(x0.length / 700));
            for (let i = 0; i < x0.length; i += stepG) {
              const [px, py] = xyToPx(ex[i], ey[i]);
              ghosts.push(<circle key={`g${i}`} cx={px} cy={py} r={1.8} fill={P.ghost} fillOpacity={0.75} />);
            }
          }

          const target: JSX.Element[] = [];
          if (showTarget) {
            const stepT = Math.max(1, Math.floor(x0.length / 700));
            for (let i = 0; i < x0.length; i += stepT) {
              const [px, py] = xyToPx(x0[i], y0[i]);
              target.push(<circle key={`t${i}`} cx={px} cy={py} r={1.8} fill={P.target} fillOpacity={0.8} />);
            }
          }

          // axis ticks
          const ticks = 8;
          const xtEls: JSX.Element[] = [];
          const ytEls: JSX.Element[] = [];
          for (let i = 0; i <= ticks; i++) {
            const v = xyMin + (i / ticks) * (xyMax - xyMin);
            const [px0] = xyToPx(v, 0); const [, py1] = xyToPx(0, v);
            xtEls.push(<line key={`xt-${i}`} x1={px0} y1={mTop + plotH} x2={px0} y2={mTop + plotH + 6} stroke={P.axes} opacity={0.6} />);
            xtEls.push(<text key={`xl-${i}`} x={px0} y={mTop + plotH + 24} fill={P.label} fontSize={14} textAnchor="middle">{Math.round(v * 10) / 10}</text>);
            ytEls.push(<line key={`yt-${i}`} x1={mSide - 6} y1={py1} x2={mSide} y2={py1} stroke={P.axes} opacity={0.6} />);
            ytEls.push(<text key={`yl-${i}`} x={mSide - 10} y={py1 + 5} fill={P.label} fontSize={14} textAnchor="end">{Math.round(v * 10) / 10}</text>);
          }

          return (
            <>
              {ghosts}
              {target}
              {pts}
              <line x1={mSide} y1={cy} x2={mSide + plotW} y2={cy} stroke={P.axes} />
              <line x1={cx} y1={mTop} x2={cx} y2={mTop + plotH} stroke={P.axes} />
              {xtEls}{ytEls}
              <text x={cx} y={height - 16} fill={P.label} fontSize={22} textAnchor="middle">x</text>
              <text x={mSide - 28} y={cy} fill={P.label} fontSize={22} textAnchor="end" dominantBaseline="middle">y</text>
            </>
          );
        })()
      )}
    </svg>
  );
};
