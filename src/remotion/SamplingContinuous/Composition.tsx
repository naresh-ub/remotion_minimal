import React, { useMemo } from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";

/** Public types */
export type Dim = "1d" | "2d";

export type SamplingContinuousProps = {
  dim: Dim;
  mode?: "light" | "dark";

  // ORIGINAL dataset (to estimate params from)
  original1d?: number[];
  original2d?: Array<{ x: number; y: number }>;

  // SAMPLES drawn from the estimated distribution
  generated1d?: number[];
  generated2d?: Array<{ x: number; y: number }>;

  // Index of latest generated sample (to pulse/ring)
  lastIndex?: number;
};

/* ---------------- Theme ---------------- */
const palette = (mode: "light" | "dark") =>
  mode === "light"
    ? {
        bg: "#ffffff",
        frame: "#e5e9f2",
        grid: "rgba(2,6,23,.08)",
        axes: "#1f2937",
        label: "#0b1324",
        pdf: "#f97316",
        orig: "#2f73c0",
        gen: "#f97316",
        ring: "#ff8a1a",
      }
    : {
        bg: "#0b1220",
        frame: "#243145",
        grid: "rgba(255,255,255,.10)",
        axes: "#cfe0f5",
        label: "#e5eefb",
        pdf: "#ffd166",
        orig: "#67e8f9",
        gen: "#ffd166",
        ring: "#ffda7a",
      };

/* ---------------- Stats helpers ---------------- */
const mean1 = (xs: number[]) =>
  xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;

const var1 = (xs: number[]) => {
  const n = xs.length;
  if (n <= 1) return 0;
  const m = mean1(xs);
  return xs.reduce((s, x) => s + (x - m) ** 2, 0) / (n - 1);
};

const mean2 = (pts: { x: number; y: number }[]) => {
  const n = pts.length || 1;
  let sx = 0,
    sy = 0;
  for (const p of pts) {
    sx += p.x;
    sy += p.y;
  }
  return [sx / n, sy / n] as const;
};

const var2diag = (pts: { x: number; y: number }[], mu: readonly [number, number]) => {
  const n = pts.length;
  if (n <= 1) return [0, 0] as const;
  let vx = 0,
    vy = 0;
  for (const p of pts) {
    vx += (p.x - mu[0]) ** 2;
    vy += (p.y - mu[1]) ** 2;
  }
  return [vx / (n - 1), vy / (n - 1)] as const;
};

const clamp = (v: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, v));

const safeSpan = (a: number, b: number, fallback = 8) =>
  b - a < 1e-6 ? fallback : b - a;

/* ---------------- Composition ---------------- */
export const SamplingContinuousComposition: React.FC<SamplingContinuousProps> = ({
  dim,
  mode = "dark",
  original1d = [],
  original2d = [],
  generated1d = [],
  generated2d = [],
  lastIndex = -1,
}) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const P = palette(mode);

  // Layout
  const TITLE_Y = 46;
  const SUB_Y = 74;
  const EQN_Y = 98;
  const REPARAM_Y = 122;
  const mTop = 150,
    mSide = 90,
    mBot = 82;
  const plotW = width - mSide * 2;
  const plotH = height - mTop - mBot;

  // Pulse for latest sample
  const pulse = 1 + 0.28 * Math.sin((frame / 16) * Math.PI);

  // Headings
  const title = "Data → Estimate → Sample";
  let subtitle = "";
  let paramEq = "";
  let reparamEq = "";

  if (dim === "1d") {
    const mu = mean1(original1d);
    const v = var1(original1d);
    const s = Math.sqrt(Math.max(1e-9, v));
    subtitle = `Original n=${original1d.length} · μ̂=${mu.toFixed(2)} · σ̂=${s.toFixed(2)}`;
    paramEq = `x ~ 𝓝(μ̂=${mu.toFixed(2)}, σ̂²=${v.toFixed(2)})`;
    reparamEq = `Reparam:  x = μ̂ + σ̂ · ε,   ε ~ 𝓝(0,1)`;
  } else {
    const mu = mean2(original2d);
    const va = var2diag(original2d, mu);
    const sx = Math.sqrt(Math.max(1e-9, va[0]));
    const sy = Math.sqrt(Math.max(1e-9, va[1]));
    subtitle = `Original n=${original2d.length} · μ̂=[${mu
      .map((v) => v.toFixed(2))
      .join(", ")}] · σ̂=[${[sx, sy].map((v) => v.toFixed(2)).join(", ")}]`;
    paramEq = `x ∈ ℝ² ~ 𝓝(μ̂=[${mu
      .map((v) => v.toFixed(2))
      .join(", ")}], Σ̂=diag(${va.map((v) => v.toFixed(2)).join(", ")}))`;
    reparamEq = `Reparam:  x = μ̂ + diag(σ̂x, σ̂y) · ε,   ε ~ 𝓝(0, I)`;
  }

  /* ------------ 1D ------------ */
  const padK = 4;
  const range1 = useMemo(() => {
    const mu = mean1(original1d);
    const s = Math.sqrt(Math.max(1e-9, var1(original1d)));
    let a = mu - padK * s;
    let b = mu + padK * s;
    if (safeSpan(a, b) === 8) {
      a = mu - 4;
      b = mu + 4;
    }
    return [a, b] as const;
  }, [original1d]);

  const xToPx1 = (x: number) =>
    mSide + ((x - range1[0]) / safeSpan(range1[0], range1[1])) * plotW;

  const OneD = () => {
    const mu = mean1(original1d);
    const v = Math.max(1e-9, var1(original1d));
    const s = Math.sqrt(v);

    // Histogram-as-density (normalized by bin width)
    const bins = 36;
    const edges = Array.from(
      { length: bins + 1 },
      (_, i) => range1[0] + (i / bins) * (range1[1] - range1[0])
    );
    const counts = new Array(bins).fill(0);
    for (const x of original1d) {
      const idx = clamp(
        Math.floor(((x - range1[0]) / (range1[1] - range1[0])) * bins),
        0,
        bins - 1
      );
      counts[idx]++;
    }
    const binW = (range1[1] - range1[0]) / bins;
    const densities = counts.map((c) =>
      original1d.length ? c / (original1d.length * binW) : 0
    );

    // Gaussian PDF curve
    const pdf = (x: number) =>
      (1 / (s * Math.sqrt(2 * Math.PI))) *
      Math.exp(-0.5 * ((x - mu) / s) ** 2);

    const xs = Array.from(
      { length: 240 },
      (_, i) => range1[0] + (i / 239) * (range1[1] - range1[0])
    );
    const pdfVals = xs.map(pdf);

    const maxY = Math.max(1e-9, ...densities, ...pdfVals);
    const yToPx = (y: number) => mTop + plotH - (y / maxY) * plotH;

    const lastX = generated1d[lastIndex];

    return (
      <>
        <rect
          x={mSide - 1}
          y={mTop - 1}
          width={plotW + 2}
          height={plotH + 2}
          fill={P.bg}
          stroke={P.frame}
        />

        {Array.from({ length: 6 }, (_, i) => {
          const y = mTop + (i / 5) * plotH;
          return (
            <line
              key={i}
              x1={mSide}
              y1={y}
              x2={mSide + plotW}
              y2={y}
              stroke={P.grid}
            />
          );
        })}

        {/* Histogram (density) */}
        {densities.map((d, i) => {
          const x0 = edges[i],
            x1 = edges[i + 1];
          const x = xToPx1(x0) + 1;
          const w = Math.max(1, xToPx1(x1) - xToPx1(x0) - 2);
          const y = yToPx(d);
          const h = mTop + plotH - y;
          return (
            <rect
              key={i}
              x={x}
              y={y}
              width={w}
              height={h}
              fill={P.orig}
              opacity={0.18}
            />
          );
        })}

        {/* Estimated PDF */}
        <path
          d={xs
            .map((x, i) => `${i === 0 ? "M" : "L"} ${xToPx1(x)} ${yToPx(pdf(x))}`)
            .join(" ")}
          fill="none"
          stroke={P.pdf}
          strokeWidth={3}
          opacity={0.95}
        />

        {/* Points (original + generated) */}
        {original1d.map((v, i) => (
          <circle
            key={`o${i}`}
            cx={xToPx1(v)}
            cy={mTop + plotH - 8}
            r={2.1}
            fill={P.orig}
            opacity={0.85}
          />
        ))}
        {generated1d.map((v, i) => {
          const isLast = i === lastIndex;
          return (
            <circle
              key={`g${i}`}
              cx={xToPx1(v)}
              cy={mTop + plotH - 8}
              r={isLast ? 4.5 * pulse : 2.6}
              fill={P.gen}
              opacity={isLast ? 1 : 0.95}
            />
          );
        })}

        <line
          x1={mSide}
          y1={mTop + plotH}
          x2={mSide + plotW}
          y2={mTop + plotH}
          stroke={P.axes}
        />
        <text
          x={mSide + plotW / 2}
          y={mTop + plotH + 32}
          fill={P.axes}
          fontSize={18}
          fontWeight={700}
          textAnchor="middle"
        >
          x (density & PDF)
        </text>
      </>
    );
  };

  /* ------------ 2D ------------ */
  const range2 = useMemo(() => {
    const mu = mean2(original2d);
    const va = var2diag(original2d, mu);
    const sx = Math.sqrt(Math.max(1e-9, va[0]));
    const sy = Math.sqrt(Math.max(1e-9, va[1]));
    let rx = [mu[0] - padK * sx, mu[0] + padK * sx] as const;
    let ry = [mu[1] - padK * sy, mu[1] + padK * sy] as const;
    if (safeSpan(rx[0], rx[1]) === 8) rx = [mu[0] - 4, mu[0] + 4] as const;
    if (safeSpan(ry[0], ry[1]) === 8) ry = [mu[1] - 4, mu[1] + 4] as const;
    return [rx, ry] as const;
  }, [original2d]);

  const xToPx2 = (x: number) =>
    mSide + ((x - range2[0][0]) / safeSpan(range2[0][0], range2[0][1])) * plotW;
  const yToPx2 = (y: number) =>
    mTop + plotH - ((y - range2[1][0]) / safeSpan(range2[1][0], range2[1][1])) * plotH;

  const TwoD = () => {
    const mu = mean2(original2d);
    const va = var2diag(original2d, mu);
    const sx = Math.sqrt(Math.max(1e-9, va[0]));
    const sy = Math.sqrt(Math.max(1e-9, va[1]));

    const last = generated2d[lastIndex];

    return (
      <>
        <rect
          x={mSide - 1}
          y={mTop - 1}
          width={plotW + 2}
          height={plotH + 2}
          fill={P.bg}
          stroke={P.frame}
        />

        {/* Crosshair at μ̂ */}
        <line x1={xToPx2(mu[0])} y1={mTop} x2={xToPx2(mu[0])} y2={mTop + plotH} stroke={P.grid} />
        <line x1={mSide} y1={yToPx2(mu[1])} x2={mSide + plotW} y2={yToPx2(mu[1])} stroke={P.grid} />

        {/* 1–3σ axis-aligned ellipses */}
        {[1, 2, 3].map((k) => (
          <ellipse
            key={k}
            cx={xToPx2(mu[0])}
            cy={yToPx2(mu[1])}
            rx={(plotW * (k * sx)) / safeSpan(range2[0][0], range2[0][1])}
            ry={(plotH * (k * sy)) / safeSpan(range2[1][0], range2[1][1])}
            fill="none"
            stroke={P.pdf}
            strokeDasharray={k === 1 ? "6 6" : k === 2 ? "4 6" : "2 6"}
            strokeWidth={k === 1 ? 2.5 : 2}
            opacity={k === 1 ? 1 : 0.8}
          />
        ))}

        {/* Points */}
        {original2d.map((p, i) => (
          <circle
            key={`o${i}`}
            cx={xToPx2(p.x)}
            cy={yToPx2(p.y)}
            r={2.4}
            fill={P.orig}
            opacity={0.85}
          />
        ))}
        {generated2d.map((p, i) => {
          const isLast = i === lastIndex;
          return (
            <circle
              key={`g${i}`}
              cx={xToPx2(p.x)}
              cy={yToPx2(p.y)}
              r={isLast ? 4.8 * pulse : 2.6}
              fill={P.gen}
              opacity={isLast ? 1 : 0.95}
            />
          );
        })}

        {last && (
          <circle
            cx={xToPx2(last.x)}
            cy={yToPx2(last.y)}
            r={10 * pulse}
            fill="none"
            stroke={P.ring}
            strokeWidth={2}
          />
        )}

        <text
          x={mSide + plotW / 2}
          y={mTop + plotH + 32}
          fill={P.axes}
          fontSize={18}
          fontWeight={700}
          textAnchor="middle"
        >
          x
        </text>
        <text
          x={mSide - 36}
          y={mTop + plotH / 2}
          fill={P.axes}
          fontSize={18}
          fontWeight={700}
          textAnchor="middle"
          transform={`rotate(-90 ${mSide - 36} ${mTop + plotH / 2})`}
        >
          y
        </text>
      </>
    );
  };

  return (
    <svg width={width} height={height} style={{ background: P.bg }}>
      {/* Title + subtitles */}
      <text
        x={width / 2}
        y={TITLE_Y}
        fill={P.label}
        fontSize={32}
        fontWeight={900}
        textAnchor="middle"
        style={{ fontFamily: '"Source Sans 3", system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial' }}
      >
        {title}
      </text>

      <text
        x={16}
        y={SUB_Y}
        fill={P.label}
        fontSize={18}
        opacity={0.95}
        style={{ fontFamily: '"Source Sans 3", system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial' }}
      >
        {subtitle}
      </text>

      <text
        x={16}
        y={EQN_Y}
        fill={P.label}
        fontSize={18}
        fontWeight={700}
        style={{ fontFamily: '"Source Sans 3", system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial' }}
      >
        {paramEq}
      </text>

      <text
        x={16}
        y={REPARAM_Y}
        fill={P.label}
        fontSize={18}
        fontWeight={700}
        style={{ fontFamily: '"Source Sans 3", system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial' }}
      >
        {reparamEq}
      </text>

      {dim === "1d" ? <OneD /> : <TwoD />}
    </svg>
  );
};
