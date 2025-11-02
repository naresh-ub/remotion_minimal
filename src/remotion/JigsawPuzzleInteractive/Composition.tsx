import React, { useMemo } from "react";
import { useCurrentFrame, interpolate, spring, useVideoConfig } from "remotion";

// Local fallback (place an image at src/_static/puzzle.jpg or change path)
import fallbackImg from "../../_static/mnist_eight.png";

export type Permutation = number[];

type Props = {
  grid: number;                  // NxN
  imageUrl?: string;             // optional external URL; falls back to local
  permFrom: Permutation;         // board state at animation start
  permTo: Permutation;           // board state at animation end
  animStartFrame: number;        // when the transition starts
  animDuration?: number;         // frames; default 48 (snappy)
  boardPadding?: number;         // padding around the square board
};

export const JigsawComposition: React.FC<Props> = ({
  grid,
  imageUrl,
  permFrom,
  permTo,
  animStartFrame,
  animDuration = 48,
  boardPadding = 12,
}) => {
  const frame = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();

  // Square board that fits inside the comp
  const size = Math.min(width, height);
  const inner = size - boardPadding * 2;
  const boardX = (width - size) / 2;
  const boardY = (height - size) / 2;
  const cell = inner / grid;
  const outline = 1.25;

  const imgHref = imageUrl || fallbackImg;

  const idxToRC = (idx: number) => ({ r: Math.floor(idx / grid), c: idx % grid });
  const posXY = (idx: number) => {
    const { r, c } = idxToRC(idx);
    return {
      x: boardX + boardPadding + c * cell,
      y: boardY + boardPadding + r * cell,
    };
  };

  // Invert permutations: tileIndex -> boardPositionIndex
  const invFrom = useMemo(() => {
    const inv = new Array(permFrom.length).fill(0);
    permFrom.forEach((tileIndex, boardPos) => (inv[tileIndex] = boardPos));
    return inv;
  }, [permFrom]);

  const invTo = useMemo(() => {
    const inv = new Array(permTo.length).fill(0);
    permTo.forEach((tileIndex, boardPos) => (inv[tileIndex] = boardPos));
    return inv;
  }, [permTo]);

  // Global, snappy spring — same profile for Shuffle and Solve
  const local = Math.max(0, frame - animStartFrame);
  const lin = interpolate(local, [0, animDuration], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const t = spring({
    fps,
    frame: lin * 30, // normalized timebase into spring
    config: { damping: 200, stiffness: 220, mass: 0.7 },
  });

  const tiles = Array.from({ length: grid * grid }, (_, tileIndex) => {
    const startPosIdx = invFrom[tileIndex];
    const endPosIdx = invTo[tileIndex];

    const start = posXY(startPosIdx);
    const end = posXY(endPosIdx);

    const x = start.x + (end.x - start.x) * t;
    const y = start.y + (end.y - start.y) * t;

    // Per-tile crop from a centered square via pattern
    const { r, c } = idxToRC(tileIndex);
    const sx = c * cell;
    const sy = r * cell;
    const patId = `pat-${tileIndex}`;

    return (
      <g key={tileIndex} transform={`translate(${x}, ${y})`}>
        <defs>
          <pattern
            id={patId}
            patternUnits="userSpaceOnUse"
            width={inner}
            height={inner}
            patternTransform={`translate(${-sx} ${-sy})`}
          >
            <image
              href={imgHref}
              x={0}
              y={0}
              width={inner}
              height={inner}
              preserveAspectRatio="xMidYMid slice"  // crop rectangle → centered square
            />
          </pattern>
        </defs>

        <rect x={0} y={0} width={cell} height={cell} fill={`url(#${patId})`} />
        <rect x={0} y={0} width={cell} height={cell} fill="none" stroke="rgba(0,0,0,0.6)" strokeWidth={outline} />
      </g>
    );
  });

  return (
    <svg width={width} height={height}>
      {/* board bg */}
      <rect x={boardX} y={boardY} width={size} height={size} fill="#0b0f17" rx={10} />
      <rect x={boardX + outline} y={boardY + outline} width={size - outline * 2} height={size - outline * 2} fill="#10151f" rx={8} />
      {tiles}
    </svg>
  );
};
