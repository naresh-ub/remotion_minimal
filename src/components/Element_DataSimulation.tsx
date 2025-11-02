import React, { useMemo, useRef, useState } from "react";
import { Player, PlayerRef } from "@remotion/player";
import {
  DataSimComposition,
  SimProps,
  kdeEstimate,
} from "../remotion/DataSim/Composition";

/* ---------- Utility ---------- */

const clampInt = (v: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, Math.floor(v)));

type Experiment = "coin" | "dice" | "n" | "gaussian";

/* ---------- Component ---------- */

const Element_DataSimulation: React.FC = () => {
  const playerRef = useRef<PlayerRef>(null);
  const pauseTimer = useRef<number | null>(null);

  // Controls
  const [exp, setExp] = useState<Experiment>("coin");
  const [sides, setSides] = useState<number>(8);         // for N-sided die
  const [batch, setBatch] = useState<number>(50);        // Generate N samples

  // Gaussian params
  const [mu, setMu] = useState<number>(0);
  const [sigma, setSigma] = useState<number>(1);
  const [bins, setBins] = useState<number>(30);
  const xMin = -5, xMax = 5;

  // Derived discrete labels
  const labels = useMemo(() => {
    if (exp === "coin") return ["H", "T"];
    if (exp === "dice") return ["1", "2", "3", "4", "5", "6"];
    if (exp === "n") {
      const n = clampInt(sides || 2, 2, 50);
      return Array.from({ length: n }, (_, i) => String(i + 1));
    }
    return []; // gaussian uses no labels
  }, [exp, sides]);

  /* ---------- State: DISCRETE ---------- */
  const [counts, setCounts] = useState<number[]>(() => labels.map(() => 0));
  const [prevCounts, setPrevCounts] = useState<number[]>(() => labels.map(() => 0));
  const totalDiscrete = counts.reduce((a, b) => a + b, 0);
  const [lastIdx, setLastIdx] = useState<number | null>(null);

  /* ---------- State: GAUSSIAN ---------- */
  const makeEdges = (b: number) => {
    const B = clampInt(b, 5, 200);
    const step = (xMax - xMin) / B;
    return Array.from({ length: B + 1 }, (_, i) => xMin + i * step);
  };
  const [binEdges, setBinEdges] = useState<number[]>(makeEdges(bins));
  const [hist, setHist] = useState<number[]>(new Array(bins).fill(0));
  const [prevHist, setPrevHist] = useState<number[]>(new Array(bins).fill(0));
  const [kdeX, setKdeX] = useState<number[]>(
    Array.from({ length: 300 }, (_, i) => xMin + (i / 299) * (xMax - xMin))
  );
  const [kde, setKde] = useState<number[]>(new Array(kdeX.length).fill(0));
  const [prevKde, setPrevKde] = useState<number[]>(new Array(kdeX.length).fill(0));
  const totalGaussian = hist.reduce((a, b) => a + b, 0);

  // Animation timing
  const fps = 60;
  const animDuration = 36; // frames (~0.6s tween)
  const [animStartFrame, setAnimStartFrame] = useState<number>(0);

  /* ---------- Sync when experiment changes ---------- */
  React.useEffect(() => {
    if (exp === "gaussian") return; // handled below

    // reshape counts arrays
    setCounts((old) => {
      const next = labels.map((_, i) => old[i] ?? 0);
      setPrevCounts(next.slice());
      setLastIdx(null);
      playerRef.current?.seekTo?.(0);
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exp, labels.length]);

  React.useEffect(() => {
    if (exp !== "gaussian") return;
    // Recompute bins/grid & reset
    const edges = makeEdges(bins);
    setBinEdges(edges);
    const B = edges.length - 1;
    setHist(new Array(B).fill(0));
    setPrevHist(new Array(B).fill(0));
    const grid = Array.from({ length: 300 }, (_, i) => xMin + (i / 299) * (xMax - xMin));
    setKdeX(grid);
    setKde(new Array(grid.length).fill(0));
    setPrevKde(new Array(grid.length).fill(0));
    playerRef.current?.seekTo?.(0);
  }, [exp, bins]);

  /* ---------- Helpers ---------- */

  const playTweenThenPause = () => {
    if (pauseTimer.current) {
      window.clearTimeout(pauseTimer.current);
      pauseTimer.current = null;
    }
    const currentFrame = playerRef.current?.getCurrentFrame?.() ?? 0;
    setAnimStartFrame(currentFrame);
    playerRef.current?.play?.();
    const ms = ((animDuration + 2) / fps) * 1000;
    pauseTimer.current = window.setTimeout(() => {
      playerRef.current?.pause?.();
      pauseTimer.current = null;
    }, ms) as unknown as number;
  };

  // Box–Muller transform for N(0,1)
  function boxMuller(): number {
    let u = 0, v = 0;
    while (u === 0) u = Math.random();
    while (v === 0) v = Math.random();
    return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  }

  function findBin(x: number, edges: number[]): number {
    const B = edges.length - 1;
    if (x <= edges[0]) return 0;
    if (x >= edges[B]) return B - 1;
    for (let i = 0; i < B; i++) {
      if (x >= edges[i] && x < edges[i + 1]) return i;
    }
    return B - 1;
  }

  /* ---------- Generate (1) ---------- */
  const onGenerateOne = () => {
    if (exp === "gaussian") {
      const sample = mu + sigma * boxMuller();

      const edges = binEdges;
      const B = edges.length - 1;
      let newHist = hist.slice();
      const idx = Math.max(0, Math.min(B - 1, findBin(sample, edges)));
      newHist[idx] += 1;

      // Build approx samples from NEW histogram
      const approxSamples: number[] = [];
      for (let i = 0; i < B; i++) {
        const mid = (edges[i] + edges[i + 1]) / 2;
        for (let k = 0; k < newHist[i]; k++) approxSamples.push(mid);
      }
      const newKde = kdeEstimate(approxSamples, kdeX);

      setPrevHist(hist.slice());
      setHist(newHist);
      setPrevKde(kde.slice());
      setKde(newKde);

      playTweenThenPause();
      return;
    }

    // Discrete 1 sample
    const k = Math.floor(Math.random() * labels.length);
    setLastIdx(k);
    setPrevCounts(counts.slice());
    const next = counts.slice();
    next[k] += 1;
    setCounts(next);
    playTweenThenPause();
  };

  /* ---------- Generate (N) ---------- */
  const onGenerateBatch = () => {
    const N = clampInt(batch || 1, 1, 100000);

    if (exp === "gaussian") {
      const edges = binEdges.slice();
      const B = edges.length - 1;

      const add = new Array(B).fill(0);
      for (let i = 0; i < N; i++) {
        const s = mu + sigma * boxMuller();
        const idx = Math.max(0, Math.min(B - 1, findBin(s, edges)));
        add[idx] += 1;
      }

      const newHist = hist.map((v, i) => v + add[i]);

      // KDE from newHist midpoints
      const approxSamples: number[] = [];
      for (let i = 0; i < B; i++) {
        const mid = (edges[i] + edges[i + 1]) / 2;
        for (let k = 0; k < newHist[i]; k++) approxSamples.push(mid);
      }
      const newKde = kdeEstimate(approxSamples, kdeX);

      setPrevHist(hist.slice());
      setHist(newHist);
      setPrevKde(kde.slice());
      setKde(newKde);

      playTweenThenPause();
      return;
    }

    // Discrete batch
    const L = labels.length;
    const add = new Array(L).fill(0);
    for (let i = 0; i < N; i++) add[Math.floor(Math.random() * L)]++;
    setLastIdx(null);
    setPrevCounts(counts.slice());
    setCounts((c) => c.map((v, i) => v + add[i]));
    playTweenThenPause();
  };

  /* ---------- Reset ---------- */
  const onReset = () => {
    if (pauseTimer.current) {
      window.clearTimeout(pauseTimer.current);
      pauseTimer.current = null;
    }
    if (exp === "gaussian") {
      const edges = makeEdges(bins);
      setBinEdges(edges);
      setHist(new Array(edges.length - 1).fill(0));
      setPrevHist(new Array(edges.length - 1).fill(0));
      const grid = Array.from({ length: 300 }, (_, i) => xMin + (i / 299) * (xMax - xMin));
      setKdeX(grid);
      setKde(new Array(grid.length).fill(0));
      setPrevKde(new Array(grid.length).fill(0));
    } else {
      const zero = labels.map(() => 0);
      setCounts(zero);
      setPrevCounts(zero);
      setLastIdx(null);
    }
    setAnimStartFrame(0);
    playerRef.current?.seekTo?.(0);
  };

  // Build Remotion input props (light mode by default)
  const simProps: SimProps = useMemo(() => {
    if (exp === "gaussian") {
      return {
        kind: "gaussian",
        xMin,
        xMax,
        binEdges,
        prevHist,
        hist,
        prevKde,
        kde,
        kdeX,
        total: totalGaussian,
        animStartFrame,
        animDuration,
        mode: "light",
      };
    }
    return {
      kind: "discrete",
      labels,
      prevCounts,
      counts,
      total: totalDiscrete,
      lastOutcomeIndex: lastIdx,
      animStartFrame,
      animDuration,
      mode: "light",
    };
  }, [
    exp,
    // discrete
    labels,
    prevCounts,
    counts,
    totalDiscrete,
    lastIdx,
    // gaussian
    binEdges,
    prevHist,
    hist,
    prevKde,
    kde,
    kdeX,
    totalGaussian,
    animStartFrame,
    animDuration,
  ]);

  /* ---------- Styles (inherit page, light-friendly) ---------- */

  const wrap: React.CSSProperties = {
    width: "100%",
    maxWidth: 900,
    margin: "0 auto",
    fontFamily:
      '"Source Sans 3", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial',
    color: "inherit",
  };
  const row: React.CSSProperties = {
    width: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    padding: "12px 14px",
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

  const table: React.CSSProperties = {
    borderCollapse: "collapse",
    fontSize: 14,
  };
  const td: React.CSSProperties = {
    border: "1px solid currentColor",
    padding: "6px 10px",
  };

  return (
    <div style={wrap}>
      {/* Video (controls hidden) */}
      <div style={{ position: "relative", width: "100%", aspectRatio: "16 / 9" }}>
        <Player
          ref={playerRef}
          component={DataSimComposition}
          inputProps={simProps}
          durationInFrames={60 * 60} // ample headroom
          compositionWidth={1280}
          compositionHeight={720}
          fps={60}
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
        <label style={{ fontWeight: 800 }}>Experiment</label>
        <select
          value={exp}
          onChange={(e) => setExp(e.target.value as Experiment)}
          style={sel}
        >
          <option value="coin">Coin (H/T)</option>
          <option value="dice">Dice (1–6)</option>
          <option value="n">N-sided die</option>
          <option value="gaussian">Gaussian (μ, σ)</option>
        </select>

        {exp === "n" && (
          <>
            <label style={{ fontWeight: 800 }}>Sides</label>
            <input
              type="number"
              min={2}
              max={50}
              value={sides}
              onChange={(e) => setSides(clampInt(Number(e.target.value) || 2, 2, 50))}
              style={numSm}
            />
          </>
        )}

        {exp === "gaussian" && (
          <>
            <label style={{ fontWeight: 800 }}>μ</label>
            <input
              type="number"
              step={0.1}
              value={mu}
              onChange={(e) => setMu(Number(e.target.value) || 0)}
              style={numSm}
            />
            <label style={{ fontWeight: 800 }}>σ</label>
            <input
              type="number"
              step={0.1}
              min={0.1}
              value={sigma}
              onChange={(e) => setSigma(Math.max(0.1, Number(e.target.value) || 1))}
              style={numSm}
            />
            <label style={{ fontWeight: 800 }}>Bins</label>
            <input
              type="number"
              min={5}
              max={200}
              value={bins}
              onChange={(e) => setBins(clampInt(Number(e.target.value) || 30, 5, 200))}
              style={numSm}
            />
          </>
        )}

        <label style={{ fontWeight: 800 }}>Batch N</label>
        <input
          type="number"
          min={1}
          max={100000}
          value={batch}
          onChange={(e) => setBatch(clampInt(Number(e.target.value) || 50, 1, 100000))}
          style={numSm}
        />

        <button type="button" onClick={onGenerateOne} style={btn}>
          Generate 1
        </button>
        <button type="button" onClick={onGenerateBatch} style={btn}>
          Generate N
        </button>
        <button type="button" onClick={onReset} style={btn}>
          Reset
        </button>
      </div>

      {/* Probability table for DISCRETE only (hide for Gaussian) */}
      {exp !== "gaussian" && (
        <div style={{ ...row, gap: 8 }}>
          <table style={table}>
            <thead>
              <tr>
                <th style={td}>Outcome</th>
                <th style={td}>Count</th>
                <th style={td}>Probability</th>
              </tr>
            </thead>
            <tbody>
              {labels.map((lab, i) => {
                const total = counts.reduce((a, b) => a + b, 0);
                const p = total > 0 ? counts[i] / total : 0;
                return (
                  <tr key={i}>
                    <td style={td}>{lab}</td>
                    <td style={td}>{counts[i]}</td>
                    <td style={td}>{p.toFixed(3)}</td>
                  </tr>
                );
              })}
              <tr>
                <td style={{ ...td, fontWeight: 700 }}>Total</td>
                <td style={{ ...td, fontWeight: 700 }}>
                  {counts.reduce((a, b) => a + b, 0)}
                </td>
                <td style={{ ...td, fontWeight: 700 }}>
                  {counts.reduce((a, b) => a + b, 0) > 0 ? "1.000" : "0.000"}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default Element_DataSimulation;
