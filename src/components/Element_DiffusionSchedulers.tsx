import React, { useMemo, useRef, useState } from "react";
import { Player, PlayerRef } from "@remotion/player";
import {
  ImageForwardComposition,
  ImageForwardProps,
} from "../remotion/DiffusionForwardImage/Composition";

const Element_ImageForwardDiffusion: React.FC = () => {
  const playerRef = useRef<PlayerRef>(null);

  const [imageUrl, setImageUrl] = useState<string>("");
  const [steps, setSteps] = useState<number>(140);
  const [scheduler, setScheduler] = useState<
    "linear" | "cosine" | "quadratic" | "sigmoid"
  >("linear");

  // pacing
  const fps = 60;
  const framesPerStep = 6;
  const tailHoldFrames = 120;
  const durationInFrames = steps * framesPerStep + tailHoldFrames;

  const props: ImageForwardProps = useMemo(
    () => ({
      imageUrl: imageUrl.trim() || undefined,
      steps,
      framesPerStep,
      tailHoldFrames,
      mode: "dark",
      internalSize: 512,
      scheduler, // NEW
    }),
    [imageUrl, steps, scheduler]
  );

  // player chrome
  const chromeBg = "rgba(0,0,0,0.85)";
  const chromeFg = "#fff";
  const seek = "#ffd166";

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
    gap: 10,
    padding: "10px 14px",
    background: "transparent",
    color: "inherit",
    flexWrap: "wrap",
  };
  const numSm: React.CSSProperties = {
    border: "1px solid currentColor",
    background: "transparent",
    color: "inherit",
    padding: "8px 10px",
    borderRadius: 10,
    fontSize: 15,
    width: 84,
    textAlign: "center" as const,
  };
  const urlInput: React.CSSProperties = {
    border: "1px solid currentColor",
    background: "transparent",
    color: "inherit",
    padding: "8px 10px",
    borderRadius: 10,
    fontSize: 15,
    minWidth: 280,
    flex: "1 1 280px",
  };
  const select: React.CSSProperties = {
    border: "1px solid currentColor",
    background: "transparent",
    color: "inherit",
    padding: "7px 10px",
    borderRadius: 10,
    fontSize: 15,
  };

  return (
    <div style={wrap}>
      {/* Video */}
      <div style={{ position: "relative", width: "100%", aspectRatio: "16/9" }}>
        <Player
          ref={playerRef}
          component={ImageForwardComposition}
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
        <label style={{ fontWeight: 800 }}>Steps</label>
        <input
          type="number"
          min={30}
          max={400}
          value={steps}
          onChange={(e) =>
            setSteps(Math.max(30, Math.min(400, Number(e.target.value) || 30)))
          }
          style={numSm}
        />

        <label style={{ fontWeight: 800 }}>Scheduler</label>
        <select
          value={scheduler}
          onChange={(e) =>
            setScheduler(e.target.value as any)
          }
          style={select}
        >
          <option value="linear">linear</option>
          <option value="cosine">cosine</option>
          <option value="quadratic">quadratic</option>
          <option value="sigmoid">sigmoid</option>
        </select>

        <label style={{ fontWeight: 800 }}>Image URL</label>
        <input
          placeholder="(optional) https://…"
          value={imageUrl}
          onChange={(e) => setImageUrl(e.target.value)}
          style={urlInput}
        />
      </div>
    </div>
  );
};

export default Element_ImageForwardDiffusion;