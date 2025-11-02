import React, { useMemo } from "react";

export type HowImageNoiseProps = {
  data: number[];
  imgH: number;
  imgW: number;
  channels: number; // 1..3
  mode: "empty" | "sample" | "reshape" | "visualize";
  theme?: "dark" | "light";
};

// hardcode canvas so we don't depend on useVideoConfig
const CANVAS_W = 1280;
const CANVAS_H = 720;

export const HowImageNoiseComposition: React.FC<HowImageNoiseProps> = ({
  data,
  imgH,
  imgW,
  channels,
  mode,
  theme = "dark",
}) => {
  const P =
    theme === "light"
      ? {
          bg: "#ffffff",
          label: "#020617",
          panel: "#e2e8f0",
          grid: "#94a3b8",
        }
      : {
          bg: "#000000",
          label: "#e2e8f0",
          panel: "#0f172a",
          grid: "#1e293b",
        };

  // no data → show prompt
  if (mode === "empty" || !data || data.length === 0) {
    return (
      <svg width={CANVAS_W} height={CANVAS_H} style={{ background: P.bg }}>
        <text
          x={CANVAS_W / 2}
          y={CANVAS_H / 2 - 10}
          textAnchor="middle"
          fill={P.label}
          fontSize={28}
          fontWeight={800}
        >
          Sample noise first
        </text>
        <text
          x={CANVAS_W / 2}
          y={CANVAS_H / 2 + 26}
          textAnchor="middle"
          fill={P.label}
          fontSize={16}
          opacity={0.6}
        >
          1. Sample → 2. Reshape → 3. Visualize
        </text>
      </svg>
    );
  }

  // clamp channels
  const ch = Math.min(3, Math.max(1, channels));
  const expectedLen = imgH * imgW * ch;

  // 1) make sure we ACTUALLY have exactly H*W*C numbers
  const flat = useMemo(() => {
    const arr = data.slice(0, expectedLen);
    if (arr.length < expectedLen) {
      const diff = expectedLen - arr.length;
      for (let i = 0; i < diff; i++) arr.push(0);
    }
    return arr;
  }, [data, expectedLen]);

  // 2) reshape to [ch][H][W]
  const reshaped = useMemo(() => {
    const out: number[][][] = [];
    for (let c = 0; c < ch; c++) {
      const chan: number[][] = [];
      for (let r = 0; r < imgH; r++) {
        const row: number[] = [];
        for (let col = 0; col < imgW; col++) {
          const idx = (r * imgW + col) * ch + c;
          row.push(flat[idx] ?? 0);
        }
        chan.push(row);
      }
      out.push(chan);
    }
    return out;
  }, [flat, ch, imgH, imgW]);

  // 3) normalized version for visualize
  const reshapedNorm = useMemo(() => {
    return reshaped.map((chan) =>
      chan.map((row) =>
        row.map((v) => {
          const t = 0.5 + 0.5 * Math.tanh(v);
          return Math.min(1, Math.max(0, t));
        })
      )
    );
  }, [reshaped]);

  // -------------------------------------------------------
  // MODE: sample → show flat
  // -------------------------------------------------------
  if (mode === "sample") {
    const maxShow = Math.min(flat.length, 220);
    return (
      <svg width={CANVAS_W} height={CANVAS_H} style={{ background: P.bg }}>
        <text
          x={CANVAS_W / 2}
          y={50}
          fill={P.label}
          fontSize={26}
          fontWeight={800}
          textAnchor="middle"
        >
          Flat noise ε ~ N(0,1)
        </text>
        <text x={30} y={80} fill={P.label} fontSize={14} opacity={0.6}>
          shape = ({imgH} × {imgW} × {ch}) → length = {flat.length}
        </text>
        <g transform="translate(30, 110)">
          {Array.from({ length: maxShow }).map((_, i) => (
            <text
              key={i}
              x={0}
              y={i * 18}
              fill={P.label}
              fontSize={13}
              fontFamily="ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace"
            >
              {`[${i.toString().padStart(3, "0")}]  ${flat[i].toFixed(6)}`}
            </text>
          ))}
          {flat.length > maxShow ? (
            <text
              x={0}
              y={maxShow * 18 + 16}
              fill={P.label}
              fontSize={13}
              opacity={0.6}
            >
              … and {flat.length - maxShow} more
            </text>
          ) : null}
        </g>
      </svg>
    );
  }

  // -------------------------------------------------------
  // MODE: reshape → show plain text by channel
  // -------------------------------------------------------
  if (mode === "reshape") {
    const blockHeight = (CANVAS_H - 120) / ch;
    const blockWidth = CANVAS_W - 60;

    return (
      <svg width={CANVAS_W} height={CANVAS_H} style={{ background: P.bg }}>
        <text
          x={CANVAS_W / 2}
          y={40}
          fill={P.label}
          fontSize={24}
          fontWeight={800}
          textAnchor="middle"
        >
          Reshaped to ({imgH} × {imgW} × {ch})
        </text>
        <text x={30} y={64} fill={P.label} fontSize={13} opacity={0.7}>
          1 block = 1 channel, 1 line = 1 row
        </text>

        {reshaped.map((chan, cIdx) => {
          const top = 90 + cIdx * blockHeight;
          return (
            <g key={cIdx}>
              <rect
                x={30}
                y={top - 22}
                width={blockWidth}
                height={blockHeight - 16}
                fill={P.panel}
                opacity={0.04}
                stroke={P.grid}
              />
              <text
                x={40}
                y={top - 6}
                fill={P.label}
                fontSize={14}
                fontWeight={600}
              >
                Channel {cIdx + 1}
              </text>
              {chan.map((row, rIdx) => (
                <text
                  key={rIdx}
                  x={40}
                  y={top + rIdx * 16}
                  fill={P.label}
                  fontSize={12}
                  fontFamily="ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace"
                >
                  {row.map((v) => v.toFixed(2)).join("  ")}
                </text>
              ))}
            </g>
          );
        })}
      </svg>
    );
  }

  // -------------------------------------------------------
  // MODE: visualize → draw colored rects
  // -------------------------------------------------------
  const mTop = 90;
  const mSide = 80;
  const panelW = CANVAS_W - mSide * 2;
  const panelH = CANVAS_H - mTop - 60;
  const cellW = panelW / Math.max(1, imgW);
  const cellH = panelH / Math.max(1, imgH);

  const cells: JSX.Element[] = [];

  for (let r = 0; r < imgH; r++) {
    for (let c = 0; c < imgW; c++) {
      const x = mSide + c * cellW;
      const y = mTop + r * cellH;

      const R = Math.round((reshapedNorm[0]?.[r]?.[c] ?? 0) * 255);
      const G =
        ch >= 2
          ? Math.round((reshapedNorm[1]?.[r]?.[c] ?? 0) * 255)
          : R;
      const B =
        ch >= 3
          ? Math.round((reshapedNorm[2]?.[r]?.[c] ?? 0) * 255)
          : R;

      cells.push(
        <rect
          key={`${r}-${c}`}
          x={x}
          y={y}
          width={cellW}
          height={cellH}
          fill={`rgb(${R},${G},${B})`}
        />
      );
    }
  }

  return (
    <svg width={CANVAS_W} height={CANVAS_H} style={{ background: P.bg }}>
      <text
        x={CANVAS_W / 2}
        y={46}
        fill={P.label}
        fontSize={24}
        fontWeight={800}
        textAnchor="middle"
      >
        Visualized as image
      </text>
      <text x={30} y={70} fill={P.label} fontSize={13} opacity={0.75}>
        ({imgH} × {imgW} × {ch}) — rectangles = pixels
      </text>

      <rect
        x={mSide - 1}
        y={mTop - 1}
        width={panelW + 2}
        height={panelH + 2}
        fill="none"
        stroke={P.grid}
      />

      {cells}
    </svg>
  );
};