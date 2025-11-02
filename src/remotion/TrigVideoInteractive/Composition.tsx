import React from "react";
import { useCurrentFrame, interpolate, Img } from "remotion";
import { Latex } from "../../Latex";

// ⬇️ put your image at: src/_static/logo.png (or any name)
// then import it like this:
import logoPng from "../../_static/naresh-ub.png"; // <-- place file here

type Mode = "light" | "dark";

export const MyCompositionTrig: React.FC<{
  graphType?: "sin" | "cos" | "tan";
  mode?: Mode;
}> = ({ graphType = "cos", mode = "dark" }) => {
  const frame = useCurrentFrame();

  const width = 1280;
  const height = 720;
  const graphWidth = 600;
  const graphHeight = 300;
  const startX = width / 4;
  const startY = height - height / 4;

  const amplitude = 50;
  const frequency = 0.05;
  const totalFrames = 300;

  const palette =
    mode === "light"
      ? {
          bg: "#ffffff",
          axis: "#111111",
          text: "#111111",
          graph: "#d97706",
          dot: "#b45309",
          dotStroke: "#92400e",
        }
      : {
          bg: "#000000",
          axis: "#ffffff",
          text: "#ffffff",
          graph: "orange",
          dot: "gold",
          dotStroke: "#FFD700",
        };

  const computeY = (x: number) => {
    const arg = x * frequency;
    if (graphType === "sin") return startY - amplitude * Math.sin(arg);
    if (graphType === "cos") return startY - amplitude * Math.cos(arg);
    const t = Math.tan(arg);
    if (!Number.isFinite(t) || Math.abs(t) > 8) return null;
    return startY - amplitude * (t * 0.1);
  };

  const progress = Math.min((frame / totalFrames) * graphWidth, graphWidth);
  const dotX = startX + progress;
  const dotYRaw = computeY(progress);
  const dotY = dotYRaw === null ? startY : dotYRaw;

  // Segmented polyline
  const segments: string[] = [];
  let current: string[] = [];
  for (let xi = 0; xi <= Math.floor(progress); xi++) {
    const y = computeY(xi);
    const px = startX + xi;
    if (y === null) {
      if (current.length > 1) segments.push(current.join(" "));
      current = [];
      continue;
    }
    current.push(`${px},${y}`);
  }
  if (current.length > 1) segments.push(current.join(" "));

  // Camera
  const zoomFactor = interpolate(frame, [0, 60, 180, totalFrames], [1, 1, 2, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const focusX = interpolate(frame, [0, 60, 180, totalFrames], [width / 2, width / 2, dotX, width / 2], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const focusY = interpolate(frame, [0, 60, 180, totalFrames], [height / 2, height / 2, dotY, height / 2], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const tipX = startX + graphWidth;
  const tipY = startY - graphHeight;
  const lx = 36;
  const ly = 28;

  return (
    <div style={{ width: "100%", height: "100%", position: "relative", background: palette.bg }}>
      {/* main SVG */}
      <svg
        width="100%"
        height="100%"
        viewBox={`${focusX - width / zoomFactor / 2} ${focusY - height / zoomFactor / 2} ${
          width / zoomFactor
        } ${height / zoomFactor}`}
        preserveAspectRatio="xMidYMid meet"
      >
        {/* Background */}
        <rect x={0} y={0} width={width} height={height} fill={palette.bg} />

        {/* Axes */}
        <line
          x1={startX}
          y1={startY}
          x2={startX + graphWidth}
          y2={startY}
          stroke={palette.axis}
          strokeWidth="2"
          markerEnd="url(#arrow)"
        />
        <line
          x1={startX}
          y1={startY}
          x2={startX}
          y2={startY - graphHeight}
          stroke={palette.axis}
          strokeWidth="2"
          markerEnd="url(#arrow)"
        />

        <defs>
          <marker id="arrow" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto">
            <path d="M 0 0 L 10 5 L 0 10 z" fill={palette.axis} />
          </marker>
          <filter id="glow" x="-150%" y="-150%" width="400%" height="400%">
            <feGaussianBlur stdDeviation="8" result="coloredBlur" />
            <feFlood floodColor={palette.dot} result="glowColor" />
            <feComposite in="glowColor" in2="coloredBlur" operator="in" result="softGlow" />
            <feMerge>
              <feMergeNode in="softGlow" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Graph */}
        {segments.map((pts, i) => (
          <polyline key={i} points={pts} stroke={palette.graph} strokeWidth="3" fill="none" strokeLinecap="round" />
        ))}

        {/* Moving dot */}
        {dotYRaw !== null && (
          <circle cx={dotX} cy={dotY} r="5" fill={palette.dot} filter="url(#glow)" stroke={palette.dotStroke} strokeWidth="2" />
        )}

        {/* y label centered on top arrow */}
        <foreignObject x={startX - lx / 2} y={tipY - ly - 6} width={lx} height={ly}>
          <div
            style={{
              width: "100%",
              height: "100%",
              color: palette.text,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Latex expression="y" fontSize={24} />
          </div>
        </foreignObject>

        {/* x label centered at right arrow tip */}
        <foreignObject x={tipX - lx / 2} y={startY - ly - 6} width={lx} height={ly}>
          <div
            style={{
              width: "100%",
              height: "100%",
              color: palette.text,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Latex expression="x" fontSize={24} />
          </div>
        </foreignObject>

        {/* Equation label (center) */}
        <foreignObject x={width / 2 - 100} y={startY - graphHeight + 120} width={200} height={50}>
          <div
            style={{
              width: "100%",
              height: "100%",
              color: palette.text,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Latex expression={`y = \\${graphType}(x)`} fontSize={30} />
          </div>
        </foreignObject>

        {/* delta near the dot */}
        {dotYRaw !== null && (
          <foreignObject x={dotX - 12} y={dotY - 45} width={30} height={30}>
            <div style={{ width: "100%", height: "100%", color: palette.text }}>
              <Latex expression="\delta" fontSize={24} />
            </div>
          </foreignObject>
        )}
      </svg>

      {/* Overlay image (top-right INSIDE the video) */}
      <Img
        src={logoPng}
        style={{
          position: "absolute",
          top: 30,
          right: 30,
          width: 100,
          height: "auto",
          objectFit: "contain",
          pointerEvents: "none",
          filter: mode === "dark" ? "drop-shadow(0 2px 6px rgba(0,0,0,.6))" : "none",
        }}
      />
    </div>
  );
};
