import React, { useRef, useState, useEffect } from "react";

type Mode = "1d" | "2d";

export type SketchPadProps = {
  mode: Mode;
  width?: number;
  height?: number;
  onUse: (out: { x1d?: Float32Array; xs2d?: Float32Array; ys2d?: Float32Array }) => void;
};

const randn = () => {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  const m = Math.sqrt(-2 * Math.log(u));
  return m * Math.cos(2 * Math.PI * v);
};

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

const SketchPad: React.FC<SketchPadProps> = ({ mode, width = 480, height = 260, onUse }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [drawing, setDrawing] = useState(false);
  const [pts, setPts] = useState<{ x: number; y: number }[]>([]);

  // draw strokes
  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const g = c.getContext("2d");
    if (!g) return;
    // inherit page colors (transparent bg)
    g.clearRect(0, 0, c.width, c.height);
    // frame
    g.strokeStyle = "currentColor";
    g.globalAlpha = 0.4;
    g.strokeRect(0.5, 0.5, c.width - 1, c.height - 1);
    g.globalAlpha = 1;

    if (pts.length < 2) return;
    g.lineWidth = 2;
    g.strokeStyle = "currentColor";
    g.beginPath();
    g.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) g.lineTo(pts[i].x, pts[i].y);
    g.stroke();
  }, [pts]);

  const getXY = (e: React.MouseEvent<HTMLCanvasElement, MouseEvent>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    return { x: clamp(x, 0, rect.width), y: clamp(y, 0, rect.height) };
    };

  const onDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    setDrawing(true);
    setPts([getXY(e)]);
  };
  const onMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!drawing) return;
    setPts((p) => [...p, getXY(e)]);
  };
  const onUp = () => setDrawing(false);
  const onLeave = () => setDrawing(false);

  const reset = () => setPts([]);

  const useAsTarget = () => {
    if (pts.length < 2) return;
    if (mode === "1d") {
      // sample x along stroke with small jitter; map x->[ -4, 4 ]
      const N = 2000;
      const xs = new Float32Array(N);
      for (let i = 0; i < N; i++) {
        const idx = Math.floor(Math.random() * pts.length);
        const px = pts[idx].x + 0.6 * randn(); // slight jitter
        const xn = clamp(px / width, 0, 1);
        xs[i] = -4 + xn * 8;
      }
      onUse({ x1d: xs });
    } else {
      // sample (x,y) along stroke with jitter; map to [-4,4]^2 (flip Y)
      const N = 3000;
      const xs = new Float32Array(N);
      const ys = new Float32Array(N);
      for (let i = 0; i < N; i++) {
        const idx = Math.floor(Math.random() * pts.length);
        const p = pts[idx];
        const px = p.x + 0.8 * randn();
        const py = p.y + 0.8 * randn();
        const xn = clamp(px / width, 0, 1);
        const yn = clamp(py / height, 0, 1);
        xs[i] = -4 + xn * 8;
        ys[i] =  4 - yn * 8; // invert Y to Cartesian
      }
      onUse({ xs2d: xs, ys2d: ys });
    }
  };

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", color: "inherit" }}>
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        onMouseDown={onDown}
        onMouseMove={onMove}
        onMouseUp={onUp}
        onMouseLeave={onLeave}
        style={{
          border: "1px solid currentColor",
          background: "transparent",
          borderRadius: 10,
          display: "block",
          cursor: "crosshair",
        }}
      />
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <button type="button" onClick={useAsTarget}
          style={{
            border: "1px solid currentColor",
            background: "transparent",
            color: "inherit",
            padding: "6px 10px",
            borderRadius: 10,
            fontSize: 14,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Use as target
        </button>
        <button type="button" onClick={reset}
          style={{
            border: "1px solid currentColor",
            background: "transparent",
            color: "inherit",
            padding: "6px 10px",
            borderRadius: 10,
            fontSize: 14,
            cursor: "pointer",
          }}
        >
          Clear
        </button>
        <div style={{ fontSize: 13, opacity: 0.85, maxWidth: 200, lineHeight: 1.2 }}>
          Draw freely. Click <b>Use as target</b> to denoise toward your sketch.
        </div>
      </div>
    </div>
  );
};

export default SketchPad;
