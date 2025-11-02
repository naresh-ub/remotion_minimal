import React, { useEffect, useMemo, useRef, useState } from "react";
import { Player, PlayerRef } from "@remotion/player";
import {
  DDPMForwardComposition,
  DDPM2DProps,
  NoiseStepParams,
} from "../remotion/DiffusionForward/Composition";

type Dist2D = DDPM2DProps["dist2d"];
type NoiseDisplay = DDPM2DProps["noiseDisplay"];

type Pt = { x: number; y: number }; // normalized [0..1]

const DEFAULTS = {
  dist2d: "spiral" as Dist2D,
  visibleCount: 400,
  steps: 120,
  gaussMeanX: 0,
  gaussMeanY: 0,
  gaussVarX: 1,
  gaussVarY: 1,
  // default to values (your request)
  noiseDisplay: "values" as NoiseDisplay,
  showNoiseOverlay: true,
};

const Element_DiffusionDDPM: React.FC = () => {
  const playerRef = useRef<PlayerRef>(null);

  // 2D only
  const [dist2d, setDist2d] = useState<Dist2D>(DEFAULTS.dist2d);

  // data points
  const [visibleCount, setVisibleCount] = useState<number>(DEFAULTS.visibleCount);

  // forward schedule
  const [steps, setSteps] = useState<number>(DEFAULTS.steps);

  // gaussian controls (CURRENT control state — used for NEW noise steps)
  const [gaussMeanX, setGaussMeanX] = useState<number>(DEFAULTS.gaussMeanX);
  const [gaussMeanY, setGaussMeanY] = useState<number>(DEFAULTS.gaussMeanY);
  const [gaussVarX, setGaussVarX] = useState<number>(DEFAULTS.gaussVarX);
  const [gaussVarY, setGaussVarY] = useState<number>(DEFAULTS.gaussVarY);

  // cumulative noise MODE
  const [noiseMode, setNoiseMode] = useState<boolean>(false);

  // HISTORY of noise steps (each stores the params at the time of click)
  const [noiseHistory, setNoiseHistory] = useState<NoiseStepParams[]>([]);

  // show noise overlay or not
  const [showNoiseOverlay, setShowNoiseOverlay] = useState<boolean>(DEFAULTS.showNoiseOverlay);

  // how to render noise overlay
  const [noiseDisplay, setNoiseDisplay] = useState<NoiseDisplay>(DEFAULTS.noiseDisplay);

  // sketch
  const [showSketch, setShowSketch] = useState<boolean>(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [pts, setPts] = useState<Pt[]>([]);
  const drawing = useRef<boolean>(false);

  const [custom2D, setCustom2D] =
    useState<{ xs: Float32Array; ys: Float32Array } | null>(null);

  // pacing
  const fps = 60;
  const framesPerStep = 6;
  const tailHoldFrames = 150;
  const durationInFrames = Math.max(1, steps * framesPerStep + tailHoldFrames);

  const noiseSteps = noiseHistory.length;

  const inputProps: DDPM2DProps = useMemo(
    () => ({
      dist2d,
      n: visibleCount,
      steps,
      custom2D,
      framesPerStep,
      tailHoldFrames,
      visibleCount,
      noiseMode,
      noiseSteps,
      noiseHistory,
      gaussMeanX,
      gaussMeanY,
      gaussVarX,
      gaussVarY,
      noiseDisplay,
      showNoiseOverlay,
    }),
    [
      dist2d,
      visibleCount,
      steps,
      custom2D,
      framesPerStep,
      tailHoldFrames,
      noiseMode,
      noiseSteps,
      noiseHistory,
      gaussMeanX,
      gaussMeanY,
      gaussVarX,
      gaussVarY,
      noiseDisplay,
      showNoiseOverlay,
    ]
  );

  // player chrome
  const chromeBg = "rgba(0,0,0,0.85)";
  const chromeFg = "#fff";
  const seek = "#ffd166";

  // styles
  const wrap: React.CSSProperties = {
    width: "100%",
    maxWidth: 900,
    margin: "0 auto",
    fontFamily:
      '"Source Sans 3", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial',
  };
  const row: React.CSSProperties = {
    width: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    padding: "10px 14px",
    background: "transparent",
    color: "inherit",
    flexWrap: "wrap",
    fontSize: 16,
  };
  const sel: React.CSSProperties = {
    border: "1px solid currentColor",
    background: "transparent",
    color: "inherit",
    padding: "10px 28px 10px 12px",
    borderRadius: 12,
    fontSize: 15,
    appearance: "none",
  };
  const numSm: React.CSSProperties = {
    border: "1px solid currentColor",
    background: "transparent",
    color: "inherit",
    padding: "10px 10px",
    borderRadius: 12,
    fontSize: 15,
    width: 84,
    textAlign: "center" as const,
  };
  const btn: React.CSSProperties = {
    border: "1px solid currentColor",
    background: "transparent",
    color: "inherit",
    padding: "10px 14px",
    borderRadius: 12,
    fontSize: 15,
    fontWeight: 700,
    cursor: "pointer",
  };
  const smallBtn: React.CSSProperties = {
    ...btn,
    padding: "6px 10px",
    fontSize: 14,
    borderRadius: 10,
  };

  // sketch drawing
  const drawCanvas = () => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const w = c.clientWidth * dpr;
    const h = c.clientHeight * dpr;
    if (c.width !== w || c.height !== h) {
      c.width = w;
      c.height = h;
    }

    ctx.clearRect(0, 0, c.width, c.height);
    ctx.fillStyle = "currentColor";
    const r = Math.max(2, Math.round(2 * dpr));
    for (const p of pts) {
      ctx.beginPath();
      ctx.arc(p.x * c.width, p.y * c.height, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.strokeStyle = "currentColor";
    ctx.globalAlpha = 0.3;
    ctx.lineWidth = Math.max(1, dpr);
    ctx.strokeRect(0.5, 0.5, c.width - 1, c.height - 1);
    ctx.globalAlpha = 1;
  };

  useEffect(() => {
    drawCanvas();
  }, [pts, showSketch]);

  const addPoint = (clientX: number, clientY: number) => {
    const c = canvasRef.current;
    if (!c) return;
    const rect = c.getBoundingClientRect();
    const x = (clientX - rect.left) / rect.width;
    const y = (clientY - rect.top) / rect.height;
    if (x >= 0 && x <= 1 && y >= 0 && y <= 1) setPts((prev) => [...prev, { x, y }]);
  };

  const onPointerDown: React.PointerEventHandler<HTMLCanvasElement> = (e) => {
    drawing.current = true;
    addPoint(e.clientX, e.clientY);
  };
  const onPointerMove: React.PointerEventHandler<HTMLCanvasElement> = (e) => {
    if (!drawing.current) return;
    addPoint(e.clientX, e.clientY);
  };
  const onPointerUp: React.PointerEventHandler<HTMLCanvasElement> = () => {
    drawing.current = false;
  };
  const onLeave: React.PointerEventHandler<HTMLCanvasElement> = () => {
    drawing.current = false;
  };

  const clearCanvas = () => setPts([]);

  const useSketch = () => {
    if (pts.length === 0) return;
    const xs = new Float32Array(visibleCount);
    const ys = new Float32Array(visibleCount);
    for (let i = 0; i < visibleCount; i++) {
      const k = Math.floor(Math.random() * pts.length);
      const p = pts[k];
      const jx = (Math.random() - 0.5) * 0.02;
      const jy = (Math.random() - 0.5) * 0.02;
      const nx = Math.min(1, Math.max(0, p.x + jx));
      const ny = Math.min(1, Math.max(0, p.y + jy));
      const vx = -4.5 + nx * 9.0;
      const vy = -4.5 + (1 - ny) * 9.0;
      xs[i] = vx;
      ys[i] = vy;
    }
    setCustom2D({ xs, ys });
    if (dist2d !== "sketch") setDist2d("sketch");
    try {
      playerRef.current?.seekTo?.(0);
      playerRef.current?.play?.();
    } catch {}
  };

  // actions
  const doAutoplay = () => {
    setNoiseMode(false);
    setNoiseHistory([]);
    try {
      playerRef.current?.seekTo?.(0);
      playerRef.current?.play?.();
    } catch {}
  };

  const doOneStepNoise = () => {
    // enter noise mode and append the current control params as ONE step
    setNoiseMode(true);
    setNoiseHistory((prev) => [
      ...prev,
      {
        gaussMeanX,
        gaussMeanY,
        gaussVarX,
        gaussVarY,
      },
    ]);
    try {
      playerRef.current?.pause?.();
      playerRef.current?.seekTo?.(0);
    } catch {}
  };

  const doRemoveNoiseStep = () => {
    setNoiseMode(true);
    setNoiseHistory((prev) => {
      if (prev.length === 0) return prev;
      return prev.slice(0, prev.length - 1);
    });
    try {
      playerRef.current?.pause?.();
      playerRef.current?.seekTo?.(0);
    } catch {}
  };

  const doReset = () => {
    setDist2d(DEFAULTS.dist2d);
    setVisibleCount(DEFAULTS.visibleCount);
    setSteps(DEFAULTS.steps);
    setGaussMeanX(DEFAULTS.gaussMeanX);
    setGaussMeanY(DEFAULTS.gaussMeanY);
    setGaussVarX(DEFAULTS.gaussVarX);
    setGaussVarY(DEFAULTS.gaussVarY);
    setNoiseMode(false);
    setNoiseHistory([]);
    setNoiseDisplay(DEFAULTS.noiseDisplay);
    setShowNoiseOverlay(DEFAULTS.showNoiseOverlay);
    setCustom2D(null);
    setShowSketch(false);
    try {
      playerRef.current?.seekTo?.(0);
      playerRef.current?.pause?.();
    } catch {}
  };

  return (
    <div style={wrap}>
      {/* Video */}
      <div style={{ position: "relative", width: "100%", aspectRatio: "16/9" }}>
        <Player
          ref={playerRef}
          component={DDPMForwardComposition}
          inputProps={inputProps}
          durationInFrames={durationInFrames}
          compositionWidth={1280}
          compositionHeight={720}
          fps={fps}
          // controls
          clickToPlay
          loop={false}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "contain",
            backgroundColor: "transparent",
            ["--remotion-player-controls-background" as any]: chromeBg,
            ["--remotion-player-controls-color" as any]: chromeFg,
            ["--remotion-player-seekbar-color" as any]: seek,
            ["--remotion-player-controls-backdrop-filter" as any]: "none",
          }}
        />
      </div>

      {/* Top controls */}
      <div style={row}>
        <label style={{ fontWeight: 800 }}>2D Dist</label>
        <select value={dist2d} onChange={(e) => setDist2d(e.target.value as Dist2D)} style={sel}>
          <option value="spiral">Spiral</option>
          <option value="ring">Ring</option>
          <option value="sketch">Sketch</option>
        </select>

        <label style={{ fontWeight: 800 }}>Steps</label>
        <input
          type="number"
          min={30}
          max={300}
          value={steps}
          onChange={(e) => setSteps(Math.max(30, Math.min(300, Number(e.target.value) || 30)))}
          style={numSm}
        />

        {/* data points */}
        <label style={{ fontWeight: 800 }}>Data pts</label>
        <input
          type="number"
          min={2}
          max={6000}
          value={visibleCount}
          onChange={(e) => {
            const v = Math.max(2, Math.min(6000, Number(e.target.value) || 2));
            setVisibleCount(v);
          }}
          style={numSm}
        />
      </div>

      {/* Noise + view controls */}
      <div style={row}>
        <label style={{ fontWeight: 800 }}>Noise μx</label>
        <input
          type="number"
          value={gaussMeanX}
          onChange={(e) => setGaussMeanX(Number(e.target.value) || 0)}
          style={numSm}
          step="0.1"
        />
        <label style={{ fontWeight: 800 }}>Noise μy</label>
        <input
          type="number"
          value={gaussMeanY}
          onChange={(e) => setGaussMeanY(Number(e.target.value) || 0)}
          style={numSm}
          step="0.1"
        />
        <label style={{ fontWeight: 800 }}>Noise σ²x</label>
        <input
          type="number"
          min={0.0001}
          value={gaussVarX}
          onChange={(e) => setGaussVarX(Math.max(0.0001, Number(e.target.value) || 0.0001))}
          style={numSm}
          step="0.1"
        />
        <label style={{ fontWeight: 800 }}>Noise σ²y</label>
        <input
          type="number"
          min={0.0001}
          value={gaussVarY}
          onChange={(e) => setGaussVarY(Math.max(0.0001, Number(e.target.value) || 0.0001))}
          style={numSm}
          step="0.1"
        />

        <button type="button" onClick={doOneStepNoise} style={btn}>
          Noise step (1x)
        </button>

        <button type="button" onClick={doRemoveNoiseStep} style={btn}>
          Remove noise step
        </button>

        <button type="button" onClick={doAutoplay} style={btn}>
          Autoplay forward
        </button>

        <label style={{ fontWeight: 800 }}>Noise view</label>
        <select
          value={noiseDisplay}
          onChange={(e) => setNoiseDisplay(e.target.value as NoiseDisplay)}
          style={sel}
        >
          <option value="dots">Dots (canvas)</option>
          <option value="values">Values (bottom)</option>
        </select>

        <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={showNoiseOverlay}
            onChange={(e) => setShowNoiseOverlay(e.target.checked)}
          />
          Show noise
        </label>

        <button type="button" onClick={doReset} style={btn}>
          Reset
        </button>
      </div>

      {/* Sketch row */}
      <div style={{ ...row, gap: 10 }}>
        <button
          type="button"
          onClick={() => setShowSketch((s) => !s)}
          style={btn}
          title="Open/close sketch pad"
        >
          {showSketch ? "Hide Sketch Pad" : "Sketch Pad"}
        </button>

        {showSketch && (
          <>
            <div style={{ position: "relative", width: 240, aspectRatio: "1/1", flex: "0 0 auto" }}>
              <canvas
                ref={canvasRef}
                style={{
                  position: "absolute",
                  inset: 0,
                  width: "100%",
                  height: "100%",
                  touchAction: "none",
                  cursor: "crosshair",
                }}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerLeave={onLeave}
              />
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <button type="button" onClick={useSketch} style={smallBtn} title="Use the drawn points">
                Use Sketch
              </button>
              <button type="button" onClick={clearCanvas} style={smallBtn} title="Clear drawing">
                Clear
              </button>
            </div>

            <div style={{ fontSize: 14, opacity: 0.9 }}>
              <div>Draw by dragging. 2D uses (x,y).</div>
              <div>
                Click <b>Use Sketch</b> to apply &amp; play.
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default Element_DiffusionDDPM;