// src/remotion/DataSim/Composition.tsx
import React from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";

/* ---------- Shared helpers ---------- */
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const easeInOut = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

/** Simple Gaussian KDE on a fixed grid */
export const kdeEstimate = (samples: number[], grid: number[]) => {
  const n = samples.length || 1;
  let mean = 0;
  for (let i = 0; i < n; i++) mean += samples[i];
  mean /= n;
  let v = 0;
  for (let i = 0; i < n; i++) {
    const d = samples[i] - mean;
    v += d * d;
  }
  v /= Math.max(1, n - 1);
  const std = Math.sqrt(Math.max(1e-6, v));
  const h = 1.06 * std * Math.pow(n, -1 / 5);

  const inv = 1 / (Math.sqrt(2 * Math.PI) * h * n);
  const ys = new Array(grid.length).fill(0);
  for (let j = 0; j < grid.length; j++) {
    const x = grid[j];
    let s = 0;
    for (let i = 0; i < n; i++) {
      const z = (x - samples[i]) / h;
      s += Math.exp(-0.5 * z * z);
    }
    ys[j] = inv * s;
  }
  return ys;
};

/* ---------- Props ---------- */
export type DiscreteProps = {
  kind: "discrete";
  labels: string[];
  prevCounts: number[];
  counts: number[];
  total: number;
  lastOutcomeIndex: number | null;
  animStartFrame: number;
  animDuration: number;
  mode?: "light" | "dark";
};

export type GaussianProps = {
  kind: "gaussian";
  xMin: number;
  xMax: number;
  binEdges: number[];
  prevHist: number[];
  hist: number[];
  prevKde: number[];
  kde: number[];
  kdeX: number[];
  total: number;
  animStartFrame: number;
  animDuration: number;
  mode?: "light" | "dark";
};

export type SimProps = DiscreteProps | GaussianProps;

/* ---------- Composition ---------- */
export const DataSimComposition: React.FC<SimProps> = (props) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();

  // Default to LIGHT theme
  const mode = props.mode ?? "light";
  const P =
    mode === "light"
      ? {
          bg: "#ffffffff",
          frame: "#e5e9f2",
          axes: "#263238",
          label: "#0b1324",
          bar: "#2f73c0",
          barHi: "#1aa776",
          grid: "rgba(2,6,23,.08)",
          legend: "rgba(15,23,42,.06)",
          line: "#0ea5e9",
        }
      : {
          bg: "#000",
          frame: "#243145",
          axes: "#aac0d4",
          label: "#dfe9f5",
          bar: "#67e8f9",
          barHi: "#22d3ee",
          grid: "rgba(255,255,255,.06)",
          legend: "rgba(255,255,255,.06)",
          line: "#67e8f9",
        };

  // ---- Top layout: give ample vertical spacing to avoid overlap
  const TITLE_Y = 44;        // centered title
  const SUBTITLE_Y = 74;     // clearly below title
  const mTop = 112;          // plot starts well below subtitle
  const mSide = 104;
  const mBot = 80;

  const plotW = width - mSide * 2;
  const plotH = height - mTop - mBot;

  const prog = clamp01(
    props.animDuration > 0 ? (frame - props.animStartFrame) / props.animDuration : 1
  );
  const t = easeInOut(prog);

  /* ---------- Title & subtitle ---------- */
  const title =
    props.kind === "discrete"
      ? "Data simulation — running probabilities"
      : "Gaussian sampling — histogram (discrete look) + KDE (continuous estimate)";

  const subtitle =
    props.kind === "discrete"
      ? `Trials: ${
          Math.round(
            (props.prevCounts.reduce((a, b) => a + b, 0) +
              (props.total -
                props.prevCounts.reduce((a, b) => a + b, 0)) * t) * 1
          ) / 1
        }`
      : `Samples: ${
          Math.round(
            (props.prevHist.reduce((a, b) => a + b, 0) +
              (props.total -
                props.prevHist.reduce((a, b) => a + b, 0)) * t) * 1
          ) / 1
        }`;

  return (
    <svg width={width} height={height} style={{ background: P.bg }}>
      {/* Title row */}
      <text
        x={width / 2}
        y={TITLE_Y}
        fill={P.label}
        fontSize={34}
        fontWeight={900}
        textAnchor="middle"
      >
        {title}
      </text>
      {/* Put subtitle below and slightly right to avoid any collision */}
      <text
        x={16}
        y={SUBTITLE_Y}
        fill={P.label}
        fontSize={18}
        opacity={0.9}
      >
        {subtitle}
      </text>

      {/* Plot frame */}
      <rect
        x={mSide - 1}
        y={mTop - 1}
        width={plotW + 2}
        height={plotH + 2}
        fill={P.bg}
        stroke={P.frame}
      />

      {props.kind === "discrete" ? (
        <BarsDiscrete
          palette={P}
          left={mSide}
          top={mTop}
          width={plotW}
          height={plotH}
          t={t}
          {...props}
        />
      ) : (
        <HistGaussian
          palette={P}
          left={mSide}
          top={mTop}
          width={plotW}
          height={plotH}
          t={t}
          {...props}
        />
      )}
    </svg>
  );
};

/* ---------- Discrete bars ---------- */
type Pal = ReturnType<typeof paletteDark>;
function paletteDark() {
  return {
    bg: "#000",
    frame: "#243145",
    axes: "#aac0d4",
    label: "#dfe9f5",
    bar: "#67e8f9",
    barHi: "#22d3ee",
    grid: "rgba(255,255,255,.06)",
    legend: "rgba(255,255,255,.06)",
    line: "#67e8f9",
  };
}

type BarsProps = DiscreteProps & {
  palette: Pal | any;
  left: number;
  top: number;
  width: number;
  height: number;
  t: number;
};

const BarsDiscrete: React.FC<BarsProps> = ({
  palette: P,
  left,
  top,
  width,
  height,
  labels,
  prevCounts,
  counts,
  total,
  lastOutcomeIndex,
  t,
}) => {
  const prevTotal = prevCounts.reduce((a, b) => a + b, 0);
  const interpCounts = counts.map((c, i) => prevCounts[i] + (c - prevCounts[i]) * t);
  const interpTotal = prevTotal + (total - prevTotal) * t || 1;
  const probs = interpCounts.map((c) => c / interpTotal);

  const maxProb = Math.max(0.25, ...probs);
  const barGap = 18;
  const barW = Math.max(20, (width - barGap * (labels.length + 1)) / labels.length);

  const yAxis = (p: number) => {
    const ratio = p / maxProb;
    return top + height - ratio * height;
  };

  const ticks = 5;
  const yTicks = Array.from({ length: ticks + 1 }, (_, i) => (i / ticks) * maxProb);

  return (
    <>
      {yTicks.map((p, i) => (
        <g key={i}>
          <line x1={left} y1={yAxis(p)} x2={left + width} y2={yAxis(p)} stroke={P.grid} />
          <text
            x={left - 10}
            y={yAxis(p) + 4}
            fill={P.label}
            fontSize={14}
            textAnchor="end"
          >
            {(Math.round(p * 1000) / 1000).toFixed(3)}
          </text>
        </g>
      ))}

      {labels.map((lab, i) => {
        const x = left + barGap + i * (barW + barGap);
        const p = probs[i];
        const yTop = yAxis(p);
        const h = top + height - yTop;
        const color = i === lastOutcomeIndex ? P.barHi : P.bar;

        return (
          <g key={i}>
            <rect x={x} y={yTop} width={barW} height={h} fill={color} />
            <text
              x={x + barW / 2}
              y={yTop - 8}
              fill={P.label}
              fontSize={16}
              textAnchor="middle"
            >
              {(Math.round(p * 1000) / 1000).toFixed(3)}
            </text>
            <text
              x={x + barW / 2}
              y={top + height + 28}
              fill={P.label}
              fontSize={18}
              fontWeight={700}
              textAnchor="middle"
            >
              {lab}
            </text>
          </g>
        );
      })}

      <text
        x={left - 56}
        y={top + height / 2}
        fill={P.axes}
        fontSize={18}
        fontWeight={700}
        textAnchor="middle"
        transform={`rotate(-90 ${left - 56} ${top + height / 2})`}
      >
        P(outcome)
      </text>
    </>
  );
};

/* ---------- Gaussian histogram + KDE ---------- */
type HistProps = GaussianProps & {
  palette: Pal | any;
  left: number;
  top: number;
  width: number;
  height: number;
  t: number;
};

const HistGaussian: React.FC<HistProps> = ({
  palette: P,
  left,
  top,
  width,
  height,
  xMin,
  xMax,
  binEdges,
  prevHist,
  hist,
  prevKde,
  kde,
  kdeX,
  t,
}) => {
  const H = hist.map((v, i) => prevHist[i] + (v - prevHist[i]) * t);
  const K = kde.map((v, i) => prevKde[i] + (v - prevKde[i]) * t);

  const maxH = Math.max(1, ...H);
  const maxK = Math.max(1e-6, ...K);

  const xToPx = (x: number) => left + ((x - xMin) / (xMax - xMin)) * width;
  const yBar = (c: number) => top + height - (c / maxH) * height;
  const yKde = (d: number) => top + height - (d / maxK) * height;

  const ticks = 5;
  const yTicks = Array.from({ length: ticks + 1 }, (_, i) => (i / ticks) * maxH);

  const kdePath = kdeX
    .map((x, i) => {
      const px = xToPx(x);
      const py = yKde(K[i]);
      return `${i === 0 ? "M" : "L"} ${px} ${py}`;
    })
    .join(" ");

  return (
    <>
      {yTicks.map((c, i) => (
        <g key={i}>
          <line x1={left} y1={yBar(c)} x2={left + width} y2={yBar(c)} stroke={P.grid} />
          <text
            x={left - 10}
            y={yBar(c) + 4}
            fill={P.label}
            fontSize={14}
            textAnchor="end"
          >
            {Math.round(c)}
          </text>
        </g>
      ))}

      {H.map((c, i) => {
        const x0 = binEdges[i];
        const x1 = binEdges[i + 1];
        const w = Math.max(1, xToPx(x1) - xToPx(x0) - 2);
        const x = xToPx(x0) + 1;
        const y = yBar(c);
        const h = top + height - y;
        return <rect key={i} x={x} y={y} width={w} height={h} fill={P.bar} opacity={0.85} />;
      })}

      <path d={kdePath} stroke={P.line} strokeWidth={3} fill="none" />

      <text
        x={left + width / 2}
        y={top + height + 28}
        fill={P.axes}
        fontSize={18}
        fontWeight={700}
        textAnchor="middle"
      >
        x
      </text>

      <text
        x={left - 56}
        y={top + height / 2}
        fill={P.axes}
        fontSize={18}
        fontWeight={700}
        textAnchor="middle"
        transform={`rotate(-90 ${left - 56} ${top + height / 2})`}
      >
        count / density
      </text>
    </>
  );
};
