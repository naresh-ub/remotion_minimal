import React, { useMemo, useRef, useState } from "react";
import { Player, PlayerRef } from "@remotion/player";
import {
  DDPMReverseComposition,
  DDPMReverseProps,
} from "../remotion/DiffusionReverse/Composition";

type Dim = DDPMReverseProps["dim"];
type Dist1D = DDPMReverseProps["dist1d"];
type Dist2D = DDPMReverseProps["dist2d"];

const Element_DiffusionDDPM_Reverse: React.FC = () => {
  const playerRef = useRef<PlayerRef>(null);

  const [dim, setDim] = useState<Dim>("2d");
  const [dist1d, setDist1d] = useState<Dist1D>("uniform");
  const [dist2d, setDist2d] = useState<Dist2D>("spiral");
  const [steps, setSteps] = useState<number>(120);  // more steps
  const [n, setN] = useState<number>(900);
  const [showTarget, setShowTarget] = useState<boolean>(true);
  const [showStartNoise, setShowStartNoise] = useState<boolean>(true);

  // pacing + end gap
  const fps = 60;
  const framesPerStep = 6;      // keep the nice tempo you liked
  const tailHoldFrames = 150;   // ~2.5s hold at the end
  const durationInFrames = Math.max(1, steps * framesPerStep + tailHoldFrames);

  const wrap: React.CSSProperties = {
    width: "100%",
    maxWidth: 900,
    margin: "0 auto",
    fontFamily:
      '"Source Sans 3", system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial',
  };
  const row: React.CSSProperties = {
    width: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    padding: "8px 12px",
    background: "inherit",
    color: "inherit",
    flexWrap: "wrap",
  };
  const sel: React.CSSProperties = {
    border: "1px solid currentColor",
    background: "transparent",
    color: "inherit",
    padding: "8px 28px 8px 10px",
    borderRadius: 10,
    fontSize: 14,
    appearance: "none",
    position: "relative",
  };
  const num: React.CSSProperties = {
    border: "1px solid currentColor",
    background: "transparent",
    color: "inherit",
    padding: "8px 10px",
    borderRadius: 10,
    fontSize: 14,
    width: 80,
    textAlign: "center" as const,
  };
  const chk: React.CSSProperties = { transform: "scale(1.1)" };

  const props: DDPMReverseProps = useMemo(
    () => ({
      dim,
      dist1d,
      dist2d,
      steps,
      n,
      showTarget,
      showStartNoise,
      framesPerStep,
      tailHoldFrames,
    }),
    [dim, dist1d, dist2d, steps, n, showTarget, showStartNoise]
  );

  const chromeBg = "rgba(0,0,0,0.85)";
  const chromeFg = "#fff";
  const seek = "#ffd166";

  const restart = () => {
    const p = playerRef.current;
    p?.pause?.(); p?.seekTo?.(0); p?.play?.();
  };

  return (
    <div style={wrap}>
      {/* Video */}
      <div style={{ position: "relative", width: "100%", aspectRatio: "16/9" }}>
        <Player
          ref={playerRef}
          component={DDPMReverseComposition}
          inputProps={props}
          durationInFrames={durationInFrames}
          compositionWidth={1280}
          compositionHeight={720}
          fps={fps}
          controls
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

      {/* Controls */}
      <div style={row}>
        <label style={{ fontWeight: 700 }}>Dim:</label>
        <select value={dim} onChange={(e) => { setDim(e.target.value as Dim); restart(); }} style={sel}>
          <option value="1d">1D</option>
          <option value="2d">2D</option>
        </select>

        {dim === "1d" ? (
          <>
            <label style={{ fontWeight: 700 }}>1D Dist:</label>
            <select value={dist1d} onChange={(e) => { setDist1d(e.target.value as any); restart(); }} style={sel}>
              <option value="uniform">Uniform</option>
              <option value="spiky">Spiky</option>
              {/* <option value="sketch">Sketch</option> */}
            </select>
          </>
        ) : (
          <>
            <label style={{ fontWeight: 700 }}>2D Dist:</label>
            <select value={dist2d} onChange={(e) => { setDist2d(e.target.value as any); restart(); }} style={sel}>
              <option value="spiral">Spiral</option>
              <option value="ring">Ring</option>
              {/* <option value="sketch">Sketch</option> */}
            </select>
          </>
        )}

        <label style={{ fontWeight: 700 }}>Steps:</label>
        <input
          type="number"
          min={20}
          max={300}
          value={steps}
          onChange={(e) => { setSteps(Math.max(20, Math.min(300, Number(e.target.value) || 20))); restart(); }}
          style={num}
        />

        <label style={{ fontWeight: 700 }}>Samples:</label>
        <input
          type="number"
          min={200}
          max={5000}
          value={n}
          onChange={(e) => { setN(Math.max(200, Math.min(5000, Number(e.target.value) || 200))); restart(); }}
          style={num}
        />

        <label style={{ fontWeight: 700 }}>Overlay:</label>
        <label style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <input type="checkbox" checked={showTarget} onChange={(e) => { setShowTarget(e.target.checked); }} style={chk} />
          Target
        </label>
        <label style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <input type="checkbox" checked={showStartNoise} onChange={(e) => { setShowStartNoise(e.target.checked); }} style={chk} />
          Start noise
        </label>
      </div>
    </div>
  );
};

export default Element_DiffusionDDPM_Reverse;
