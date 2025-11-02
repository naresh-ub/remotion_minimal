import React, { useRef, useState } from "react";
import { Player, PlayerRef } from "@remotion/player";
import { JigsawComposition, Permutation } from "../remotion/JigsawPuzzleInteractive/Composition";

// Import your two images (place them in src/_static/)
import imgFirst from "../_static/mnist_eight.png";
import imgSecond from "../_static/letter.png";

// --- helpers ---
const identity = (n: number): Permutation =>
  Array.from({ length: n * n }, (_, i) => i);

// Deterministic RNG (Mulberry32)
const mulberry32 = (seed: number) => {
  return () => {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

// Seeded shuffle so "shuffled" state persists across grid changes without anim
const seededShuffle = (n: number, seed: number): Permutation => {
  const arr = identity(n);
  const rnd = mulberry32(seed);
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  if (arr.every((v, i) => v === i) && arr.length > 1) [arr[0], arr[1]] = [arr[1], arr[0]];
  return arr;
};

type LastAction = "solved" | "shuffled";
type WhichImage = "first" | "second";

const Element_JigsawPuzzle: React.FC = () => {
  const playerRef = useRef<PlayerRef>(null);
  const pauseTimerRef = useRef<number | null>(null);

  const [grid, setGrid] = useState<number>(3);
  const [whichImage, setWhichImage] = useState<WhichImage>("first");

  const [perm, setPerm] = useState<Permutation>(() => identity(3));
  const [permFrom, setPermFrom] = useState<Permutation>(() => identity(3));
  const [permTo, setPermTo] = useState<Permutation>(() => identity(3));
  const [animStartFrame, setAnimStartFrame] = useState<number>(0);

  // animation timing (snappy)
  const fps = 60;
  const animDuration = 48;           // frames (~0.8s)
  const durationInFrames = 60 * 60;  // long headroom

  // state & seed to persist shuffled layouts across grid changes
  const [isAnimating, setIsAnimating] = useState(false);
  const [lastAction, setLastAction] = useState<LastAction>("solved");
  const [shuffleSeed, setShuffleSeed] = useState<number>(() => Math.floor(Math.random() * 1e9));

  const clearPauseTimer = () => {
    if (pauseTimerRef.current) {
      window.clearTimeout(pauseTimerRef.current);
      pauseTimerRef.current = null;
    }
  };

  // ---- Animation trigger (kept exactly like your “good” feel) ----
  const startTransition = (nextPerm: Permutation, nextLast: LastAction) => {
    if (isAnimating) return; // atomic

    clearPauseTimer();

    const currentFrame = playerRef.current?.getCurrentFrame?.() ?? 0;

    setPermFrom(perm);
    setPermTo(nextPerm);
    setAnimStartFrame(currentFrame);
    setPerm(nextPerm);

    setIsAnimating(true);
    setLastAction(nextLast);
    playerRef.current?.play?.();

    // pause right after the tween completes (small buffer)
    const ms = ((animDuration + 2) / fps) * 1000;
    pauseTimerRef.current = window.setTimeout(() => {
      playerRef.current?.pause?.();
      setIsAnimating(false);
      pauseTimerRef.current = null;
    }, ms) as unknown as number;
  };
  // ---------------------------------------------------------------

  const onShuffle = () => {
    // bump seed so each Shuffle click gives a fresh permutation
    const newSeed = (shuffleSeed + 1) >>> 0;
    setShuffleSeed(newSeed);
    startTransition(seededShuffle(grid, newSeed), "shuffled");
  };

  const onSolve = () => startTransition(identity(grid), "solved");

  // GRID CHANGE: keep current state with NO animation and NO re-randomization
  React.useEffect(() => {
    clearPauseTimer();
    setIsAnimating(false);

    playerRef.current?.pause?.();

    const target =
      lastAction === "shuffled" ? seededShuffle(grid, shuffleSeed) : identity(grid);

    setPerm(target);
    setPermFrom(target);
    setPermTo(target);
    setAnimStartFrame(0);

    playerRef.current?.seekTo?.(0);
  }, [grid]); // intentionally not depending on lastAction/shuffleSeed

  // IMAGE CHANGE: just swap the asset, keep permutation/state as-is (no animation)
  React.useEffect(() => {
    // No timeline change needed; composition reads new src each frame.
  }, [whichImage]);

  // styles (inherit page colors)
  const wrap: React.CSSProperties = {
    width: "100%",
    maxWidth: 900,
    margin: "0 auto",
    fontFamily: '"Source Sans 3", system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial',
  };
  const row: React.CSSProperties = {
    width: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    padding: "8px 12px",
    background: "inherit",
    color: "inherit",
    flexWrap: "wrap",
  };
  const btn: React.CSSProperties = {
    border: "1px solid currentColor",
    background: "transparent",
    color: "inherit",
    padding: "8px 12px",
    borderRadius: 10,
    cursor: isAnimating ? "default" : "pointer",
    fontSize: 14,
    fontWeight: 600,
    opacity: isAnimating ? 0.6 : 1,
    pointerEvents: isAnimating ? ("none" as const) : ("auto" as const),
  };
  const num: React.CSSProperties = {
    border: "1px solid currentColor",
    background: "transparent",
    color: "inherit",
    padding: "8px 10px",
    borderRadius: 10,
    fontSize: 14,
    width: 64,
    textAlign: "center" as const,
    opacity: isAnimating ? 0.6 : 1,
    pointerEvents: isAnimating ? ("none" as const) : ("auto" as const),
  };
  const selectCss: React.CSSProperties = {
    border: "1px solid currentColor",
    background: "transparent",
    color: "inherit",
    padding: "8px 28px 8px 10px",
    borderRadius: 10,
    fontSize: 14,
    appearance: "none",
    WebkitAppearance: "none" as any,
    MozAppearance: "none" as any,
    position: "relative",
  };

  // Choose image
  const selectedImage = whichImage === "first" ? imgFirst : imgSecond;

  return (
    <div style={wrap}>
      {/* SQUARE canvas, no controls */}
      <div style={{ position: "relative", width: "100%", aspectRatio: "1 / 1" }}>
        <Player
          ref={playerRef}
          component={JigsawComposition}
          inputProps={{
            grid,
            imageUrl: selectedImage, // pass the picked image
            permFrom,
            permTo,
            animStartFrame,
            animDuration,
          }}
          durationInFrames={durationInFrames}
          compositionWidth={720}
          compositionHeight={720}
          fps={fps}
          controls={false}
          clickToPlay={false}
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

      {/* Single row: Grid, Shuffle, Solve, Image selector (to the right) */}
      <div style={row}>
        <label style={{ fontWeight: 700, fontSize: 16 }}>Grid:</label>
        <input
          type="number"
          min={2}
          max={20}
          value={grid}
          onChange={(e) =>
            setGrid(Math.max(2, Math.min(20, Number(e.target.value) || 2)))
          }
          style={num}
        />
        <button type="button" onClick={onShuffle} style={btn}>Shuffle</button>
        <button type="button" onClick={onSolve} style={btn}>Solve</button>

        {/* Image selector on the right side */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginLeft: 12 }}>
          <span style={{ fontSize: 14, opacity: 0.85 }}>Image:</span>
          <div style={{ position: "relative" }}>
            <select
              value={whichImage}
              onChange={(e) => setWhichImage(e.target.value as WhichImage)}
              style={selectCss}
              aria-label="Choose image"
            >
              <option value="first">First image</option>
              <option value="second">Second image</option>
            </select>
            {/* compact chevron */}
            <svg
              width="16" height="16" viewBox="0 0 24 24"
              style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}
            >
              <path d="M7 10l5 5 5-5" fill="none" stroke="currentColor" strokeWidth="2" />
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Element_JigsawPuzzle;
