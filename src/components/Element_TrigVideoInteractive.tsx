import React, { useState } from "react";
import { Player } from "@remotion/player";
import { MyCompositionTrig } from "../remotion/TrigVideoInteractive/Composition";

const Element_TrigVideoInteractive: React.FC = () => {
  const [graphType, setGraphType] = useState<"sin" | "cos" | "tan">("cos");
  const [mode, setMode] = useState<"light" | "dark">("dark"); // ← affects only video

  // Keep Remotion playback chrome dark for contrast
  const chromeBg = "rgba(0,0,0,0.85)";
  const chromeFg = "#fff";
  const seek = "#ffd166";

  return (
    <div
      style={{
        width: "100%",
        maxWidth: 900,
        margin: "0 auto",
        fontFamily:
          '"Source Sans 3", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial',
        /* DO NOT set color/background here; let host page theme control it */
      }}
    >
      {/* Responsive video via aspect-ratio box */}
      <div style={{ position: "relative", width: "100%", aspectRatio: "16 / 9" }}>
        <Player
          component={MyCompositionTrig}
          durationInFrames={500}
          compositionWidth={1280}
          compositionHeight={720}
          fps={60}
          controls
          clickToPlay
          inputProps={{ graphType, mode }} // only video uses this
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "fill",
            backgroundColor: "transparent",
            ["--remotion-player-background-color" as any]: "transparent",
            ["--remotion-player-controls-background" as any]: chromeBg,
            ["--remotion-player-controls-color" as any]: chromeFg,
            ["--remotion-player-seekbar-color" as any]: seek,
            ["--remotion-player-controls-backdrop-filter" as any]: "none",
          }}
          loop
        />
      </div>

      {/* FULL-WIDTH controls bar — PURELY INHERITED STYLING */}
      <div
        style={{
          width: "100%",
          marginTop: 0,
          background: "inherit",   // follow page background (no coupling to toggle)
          color: "inherit",        // follow page text
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          padding: "8px 12px",
          borderRadius: 0,         // flush with video bottom
        }}
      >
        {/* Center group */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            margin: "0 auto",
            color: "inherit",
          }}
        >
          <span style={{ fontSize: 16, fontWeight: 700 }}>Choose Graph:</span>

          <div style={{ position: "relative" }}>
            <select
              aria-label="Choose Graph"
              value={graphType}
              onChange={(e) => setGraphType(e.target.value as any)}
              style={{
                padding: "8px 28px 8px 10px",
                fontSize: 16,
                borderRadius: 10,
                border: "1px solid currentColor",
                background: "transparent",
                color: "inherit",
                outline: "none",
                cursor: "pointer",
                appearance: "none",
                WebkitAppearance: "none" as any,
                MozAppearance: "none" as any,
                lineHeight: 1.2,
              }}
            >
              <option value="sin">Sine (sin)</option>
              <option value="cos">Cosine (cos)</option>
              <option value="tan">Tangent (tan)</option>
            </select>

            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              style={{
                position: "absolute",
                right: 8,
                top: "50%",
                transform: "translateY(-50%)",
                pointerEvents: "none",
              }}
            >
              <path d="M7 10l5 5 5-5" fill="none" stroke="currentColor" strokeWidth="2" />
            </svg>
          </div>
        </div>

        {/* Toggle — neutral visuals; only flips video mode */}
        <button
          type="button"
          onClick={() => setMode((m) => (m === "dark" ? "light" : "dark"))}
          title={mode === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          style={{
            width: 40,
            height: 40,
            borderRadius: 999,
            border: "1px solid currentColor",
            background: "transparent",
            color: "currentColor",
            display: "grid",
            placeItems: "center",
            cursor: "pointer",
            marginRight: 20,
          }}
        >
          {mode === "dark" ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <circle cx="12" cy="12" r="4"></circle>
              <g stroke="currentColor" strokeWidth="2">
                <line x1="12" y1="2" x2="12" y2="5" />
                <line x1="12" y1="19" x2="12" y2="22" />
                <line x1="4.22" y1="4.22" x2="6.34" y2="6.34" />
                <line x1="17.66" y1="17.66" x2="19.78" y2="19.78" />
                <line x1="2" y1="12" x2="5" y2="12" />
                <line x1="19" y1="12" x2="22" y2="12" />
                <line x1="4.22" y1="19.78" x2="6.34" y2="17.66" />
                <line x1="17.66" y1="6.34" x2="19.78" y2="4.22" />
              </g>
            </svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M21 12.79A9 9 0 0 1 11.21 3 7 7 0 1 0 21 12.79z" />
            </svg>
          )}
        </button>
      </div>
    </div>
  );
};

export default Element_TrigVideoInteractive;
