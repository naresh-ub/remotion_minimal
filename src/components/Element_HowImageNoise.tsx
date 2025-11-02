import React, { useMemo, useRef, useState } from "react";
import { Player, PlayerRef } from "@remotion/player";
import {
  HowImageNoiseComposition,
  HowImageNoiseProps,
} from "../remotion/HowImageNoise/Composition";

const Element_HowImageNoise: React.FC = () => {
  const playerRef = useRef<PlayerRef>(null);

  // input controls
  const [imgH, setImgH] = useState(2);
  const [imgW, setImgW] = useState(2);
  const [channels, setChannels] = useState(1);

  // actual sampled stuff
  const [data, setData] = useState<number[]>([]);
  const [sampledShape, setSampledShape] = useState<{
    h: number;
    w: number;
    c: number;
  } | null>(null);

  const [mode, setMode] = useState<"empty" | "sample" | "reshape" | "visualize">(
    "empty"
  );

  const resetPlayer = () => {
    try {
      playerRef.current?.pause?.();
      playerRef.current?.seekTo?.(0);
    } catch {}
  };

  const handleSample = () => {
    const H = Math.max(1, Math.min(256, imgH));
    const W = Math.max(1, Math.min(256, imgW));
    const C = Math.max(1, Math.min(3, channels));
    const total = H * W * C;
    const out: number[] = [];

    for (let i = 0; i < total; i++) {
      // N(0,1)
      let u = Math.random();
      let v = Math.random();
      if (u === 0) u = 1e-9;
      const m = Math.sqrt(-2 * Math.log(u));
      const z = m * Math.cos(2 * Math.PI * v);
      out.push(z);
    }

    setData(out);
    setSampledShape({ h: H, w: W, c: C });
    setChannels(C); // keep input in sync
    setMode("sample");
    resetPlayer();
  };

  const handleReshape = () => {
    if (!data.length || !sampledShape) return;
    setMode("reshape");
    resetPlayer();
  };

  const handleVisualize = () => {
    if (!data.length || !sampledShape) return;
    setMode("visualize");
    resetPlayer();
  };

  // what we actually send
  const effH = sampledShape ? sampledShape.h : imgH;
  const effW = sampledShape ? sampledShape.w : imgW;
  const effC = sampledShape ? sampledShape.c : channels;

  const inputProps: HowImageNoiseProps = useMemo(
    () => ({
      data,
      imgH: effH,
      imgW: effW,
      channels: effC,
      mode,
      theme: "dark",
    }),
    [data, effH, effW, effC, mode]
  );

  const fps = 60;
  const durationInFrames = 120;

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
    flexWrap: "wrap",
  };
  const num: React.CSSProperties = {
    border: "1px solid currentColor",
    background: "transparent",
    color: "inherit",
    padding: "8px 10px",
    borderRadius: 10,
    fontSize: 14,
    width: 74,
    textAlign: "center" as const,
  };
  const btn: React.CSSProperties = {
    border: "1px solid currentColor",
    background: "transparent",
    color: "inherit",
    padding: "10px 14px",
    borderRadius: 12,
    fontSize: 15,
    fontWeight: 600,
    cursor: "pointer",
  };

  return (
    <div style={wrap}>
      {/* Player */}
      <div style={{ position: "relative", width: "100%", aspectRatio: "16/9" }}>
        <Player
          key={`${mode}-${data.length}-${effH}-${effW}-${effC}`}
          ref={playerRef}
          component={HowImageNoiseComposition}
          inputProps={inputProps}
          durationInFrames={durationInFrames}
          compositionWidth={1280}
          compositionHeight={720}
          fps={fps}
          controls={false}
          loop={false}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            backgroundColor: "transparent",
          }}
        />
      </div>

      {/* dimension controls */}
      <div style={row}>
        <label style={{ fontWeight: 700 }}>H</label>
        <input
          type="number"
          min={1}
          max={256}
          value={imgH}
          onChange={(e) =>
            setImgH(Math.max(1, Math.min(256, Number(e.target.value) || 1)))
          }
          style={num}
        />
        <label style={{ fontWeight: 700 }}>W</label>
        <input
          type="number"
          min={1}
          max={256}
          value={imgW}
          onChange={(e) =>
            setImgW(Math.max(1, Math.min(256, Number(e.target.value) || 1)))
          }
          style={num}
        />
        <label style={{ fontWeight: 700 }}>C</label>
        <input
          type="number"
          min={1}
          max={3}
          value={channels}
          onChange={(e) =>
            setChannels(Math.max(1, Math.min(3, Number(e.target.value) || 1)))
          }
          style={num}
        />
      </div>

      {/* actions */}
      <div style={row}>
        <button style={btn} onClick={handleSample}>
          Sample
        </button>
        <button style={btn} onClick={handleReshape}>
          Reshape
        </button>
        <button style={btn} onClick={handleVisualize}>
          Visualize
        </button>
        <div style={{ opacity: 0.6, fontSize: 13 }}>
          {data.length
            ? `len=${data.length} (${effH}×${effW}×${effC})`
            : "no sample yet"}
        </div>
      </div>
    </div>
  );
};

export default Element_HowImageNoise;