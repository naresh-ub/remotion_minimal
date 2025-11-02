import React, { useMemo, useRef, useState } from "react";
import { Player, PlayerRef } from "@remotion/player";
import {
  SamplingContinuousComposition,
  SamplingContinuousProps,
  Dim,
} from "../remotion/SamplingContinuous/Composition";

/* ---------- Palette + Font ---------- */
const UI = {
  text: "#e6eefc",
  surface: "#0f1a2a",
  surfaceHi: "#14243d",
  inputBg: "#0b1324",
  border: "#264876",
  primary: "#3b82f6",
  primaryHover: "#2563eb",
};

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

const Element_SamplingContinuous: React.FC = () => {
  const playerRef = useRef<PlayerRef>(null);
  const fps = 60;
  const durationInFrames = 60 * 60;

  // Dim
  const [dim, setDim] = useState<Dim>("2d");

  // Ground-truth params (for generating ORIGINALS)
  const [gt1, setGt1] = useState<{ mu: number; sigma: number }>({
    mu: 0,
    sigma: 1,
  });
  const [gt2, setGt2] = useState<{
    mux: number;
    muy: number;
    sx: number;
    sy: number;
  }>({ mux: 0, muy: 0, sx: 1, sy: 1 });

  // Originals count control
  const [originsN, setOriginsN] = useState<number>(400);

  // Datasets
  const [orig1, setOrig1] = useState<number[]>([]);
  const [orig2, setOrig2] = useState<Array<{ x: number; y: number }>>([]);

  const [gen1, setGen1] = useState<number[]>([]);
  const [gen2, setGen2] = useState<Array<{ x: number; y: number }>>([]);

  const [lastIndex, setLastIndex] = useState<number>(-1);

  const rng = useMemo(() => mulberry32(12345), []);

  /* Sample from ESTIMATED distribution (μ̂, Σ̂) */
  const sampleFromEstimated = () => {
    if (dim === "1d") {
      const n = orig1.length || 1;
      const mu = orig1.reduce((a, b) => a + b, 0) / n;
      const v =
        n > 1
          ? orig1.reduce((s, x) => s + (x - mu) ** 2, 0) / (n - 1)
          : 1;
      const sigma = Math.sqrt(Math.max(1e-9, v));
      const x = mu + sigma * randn(rng);
      const arr = [...gen1, x];
      setGen1(arr);
      setLastIndex(arr.length - 1);
      playerRef.current?.seekTo?.(0);
      return;
    }
    const n = orig2.length || 1;
    const mux = orig2.reduce((s, p) => s + p.x, 0) / n;
    const muy = orig2.reduce((s, p) => s + p.y, 0) / n;
    const vx =
      n > 1 ? orig2.reduce((s, p) => s + (p.x - mux) ** 2, 0) / (n - 1) : 1;
    const vy =
      n > 1 ? orig2.reduce((s, p) => s + (p.y - muy) ** 2, 0) / (n - 1) : 1;
    const sx = Math.sqrt(Math.max(1e-9, vx));
    const sy = Math.sqrt(Math.max(1e-9, vy));
    const x = mux + sx * randn(rng);
    const y = muy + sy * randn(rng);
    const arr = [...gen2, { x, y }];
    setGen2(arr);
    setLastIndex(arr.length - 1);
    playerRef.current?.seekTo?.(0);
  };

  /* Generate ORIGINALS from ground-truth */
  const generateOriginals = () => {
    const n = Math.max(1, Math.min(20000, Math.floor(originsN) || 1));
    if (dim === "1d") {
      const arr = Array.from({ length: n }, () => gt1.mu + gt1.sigma * randn(rng));
      setOrig1(arr);
      setGen1([]);
      setLastIndex(-1);
      playerRef.current?.seekTo?.(0);
      return;
    }
    const arr = Array.from({ length: n }, () => ({
      x: gt2.mux + gt2.sx * randn(rng),
      y: gt2.muy + gt2.sy * randn(rng),
    }));
    setOrig2(arr);
    setGen2([]);
    setLastIndex(-1);
    playerRef.current?.seekTo?.(0);
  };

  const resetAll = () => {
    setOrig1([]);
    setOrig2([]);
    setGen1([]);
    setGen2([]);
    setLastIndex(-1);
    playerRef.current?.seekTo?.(0);
  };

  const inputProps: SamplingContinuousProps = useMemo(
    () => ({
      dim,
      mode: "dark",
      original1d: orig1,
      original2d: orig2,
      generated1d: gen1,
      generated2d: gen2,
      lastIndex,
    }),
    [dim, orig1, orig2, gen1, gen2, lastIndex]
  );

  /* ---------- Styled UI (Source Sans 3, small radii) ---------- */
  const wrap: React.CSSProperties = {
    width: "100%",
    maxWidth: 980,
    margin: "0 auto",
    color: UI.text,
    fontFamily:
      '"Source Sans 3", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial',
    background: UI.surface,
    border: `1px solid ${UI.border}`,
    borderRadius: 8,
    boxShadow: "0 8px 30px rgba(0,0,0,.35)",
    overflow: "hidden",
  };
  const row: React.CSSProperties = {
    display: "flex",
    flexWrap: "wrap",
    gap: 12,
    alignItems: "center",
    justifyContent: "center",
    padding: "12px 14px",
    background: UI.surfaceHi,
    borderTop: `1px solid ${UI.border}`,
  };
  const fieldBase: React.CSSProperties = {
    border: `1px solid ${UI.border}`,
    background: UI.inputBg,
    color: UI.text,
    borderRadius: 8,
    outline: "none",
    transition: "box-shadow .15s ease, border-color .15s ease",
  };
  const sel: React.CSSProperties = {
    ...fieldBase,
    padding: "10px 28px 10px 12px",
    fontSize: 15,
    appearance: "none",
  };
  const num: React.CSSProperties = {
    ...fieldBase,
    padding: "10px 10px",
    fontSize: 15,
    width: 96,
    textAlign: "center" as const,
  };
  const btn: React.CSSProperties = {
    border: "none",
    background: UI.primary,
    color: UI.text,
    padding: "10px 14px",
    borderRadius: 8,
    fontSize: 15,
    fontWeight: 800,
    cursor: "pointer",
    transition: "background .15s ease",
  };
  const hover = (e: React.MouseEvent<HTMLButtonElement>) =>
    (e.currentTarget.style.background = UI.primaryHover);
  const unhover = (e: React.MouseEvent<HTMLButtonElement>) =>
    (e.currentTarget.style.background = UI.primary);

  return (
    <div style={wrap}>
      {/* Video */}
      <div
        style={{
          position: "relative",
          width: "100%",
          aspectRatio: "16/9",
          background: "#0b1220",
        }}
      >
        <Player
          ref={playerRef}
          component={SamplingContinuousComposition}
          inputProps={inputProps}
          durationInFrames={durationInFrames}
          compositionWidth={1280}
          compositionHeight={720}
          fps={fps}
          controls={false}
          clickToPlay
          loop={false}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "contain",
            backgroundColor: "transparent",
          }}
        />
      </div>

      {/* Controls */}
      <div style={row}>
        <label>
          <b>Dim</b>
        </label>
        <select
          value={dim}
          onChange={(e) => setDim(e.target.value as Dim)}
          style={sel}
        >
          <option value="1d">1D</option>
          <option value="2d">2D</option>
        </select>

        {/* Originals count */}
        <label>
          <b>Originals N</b>
        </label>
        <input
          type="number"
          min={1}
          max={20000}
          value={originsN}
          onChange={(e) =>
            setOriginsN(Math.max(1, Math.min(20000, Number(e.target.value) || 1)))
          }
          style={num}
        />

        {dim === "1d" ? (
          <>
            <label>
              <b>μ (gt)</b>
            </label>
            <input
              type="number"
              value={gt1.mu}
              onChange={(e) => setGt1({ ...gt1, mu: Number(e.target.value) })}
              style={num}
            />
            <label>
              <b>σ (gt)</b>
            </label>
            <input
              type="number"
              min={0.05}
              step={0.1}
              value={gt1.sigma}
              onChange={(e) =>
                setGt1({ ...gt1, sigma: Math.max(0.05, Number(e.target.value)) })
              }
              style={num}
            />
          </>
        ) : (
          <>
            <label>
              <b>μx</b>
            </label>
            <input
              type="number"
              value={gt2.mux}
              onChange={(e) => setGt2({ ...gt2, mux: Number(e.target.value) })}
              style={num}
            />
            <label>
              <b>μy</b>
            </label>
            <input
              type="number"
              value={gt2.muy}
              onChange={(e) => setGt2({ ...gt2, muy: Number(e.target.value) })}
              style={num}
            />
            <label>
              <b>σx</b>
            </label>
            <input
              type="number"
              min={0.05}
              step={0.1}
              value={gt2.sx}
              onChange={(e) =>
                setGt2({ ...gt2, sx: Math.max(0.05, Number(e.target.value)) })
              }
              style={num}
            />
            <label>
              <b>σy</b>
            </label>
            <input
              type="number"
              min={0.05}
              step={0.1}
              value={gt2.sy}
              onChange={(e) =>
                setGt2({ ...gt2, sy: Math.max(0.05, Number(e.target.value)) })
              }
              style={num}
            />
          </>
        )}
      </div>

      <div style={row}>
        <button
          type="button"
          onClick={generateOriginals}
          style={btn}
          onMouseEnter={hover}
          onMouseLeave={unhover}
        >
          Generate originals
        </button>

        <button
          type="button"
          onClick={sampleFromEstimated}
          style={btn}
          onMouseEnter={hover}
          onMouseLeave={unhover}
        >
          Sample from estimated
        </button>

        <button
          type="button"
          onClick={resetAll}
          style={btn}
          onMouseEnter={hover}
          onMouseLeave={unhover}
        >
          Reset
        </button>
      </div>
    </div>
  );
};

export default Element_SamplingContinuous;
