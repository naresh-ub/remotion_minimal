import React, { useState } from "react";
import { Player } from "@remotion/player";
import { MyCompositionDot as MatrixDotProduct } from "../remotion/DotProductInteractive/Composition";

const Element_DotProductInteractive: React.FC = () => {
  const [matrixA, setMatrixA] = useState([
    [1, 2, 3],
    [4, 5, 6],
    [7, 8, 9],
  ]);
  const [matrixB, setMatrixB] = useState([
    [1, 0, 0],
    [0, 1, 0],
    [0, 0, 1],
  ]);

  const handleInputChange = (matrix: "A" | "B", row: number, col: number, value: number) => {
    if (matrix === "A") {
      const newMatrix = matrixA.map((r, i) => r.map((v, j) => (i === row && j === col ? value : v)));
      setMatrixA(newMatrix);
    } else {
      const newMatrix = matrixB.map((r, i) => r.map((v, j) => (i === row && j === col ? value : v)));
      setMatrixB(newMatrix);
    }
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        height: "auto",
        width: "100%",
        maxWidth: "900px", // ✅ Restrict width for better alignment
        backgroundColor: "gray",
        color: "white",
        textAlign: "center",
        padding: "20px",
        borderRadius: "10px",
      }}
    >
      <h2 style={{ color: "white" }}>Interactive Matrix Dot Product</h2>

      {/* Remotion Player */}
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          width: "100%",
          maxWidth: "750px", // ✅ Keep within div
          borderRadius: "10px",
          marginBottom: "20px",
        }}
      >
        <Player
          component={MatrixDotProduct}
          durationInFrames={1710} // Total frames calculated
          compositionWidth={1280}
          compositionHeight={720}
          fps={60}
          controls
          inputProps={{ matrixA, matrixB }}
          style={{
            width: "100%",
            maxWidth: "750px", // ✅ Keep sizing within div
            borderRadius: "10px",
          }}
        />
      </div>

      {/* Matrix Input Fields - Fixed Sizing & Alignment */}
      <div
        style={{
          display: "flex",
          flexDirection: "row", // Ensures side-by-side layout
          flexWrap: "nowrap", // Prevents stacking
          justifyContent: "center",
          gap: "30px", // ✅ Adjust spacing
          width: "100%",
          maxWidth: "750px",
          padding: "10px",
        }}
      >
        {/* Matrix A */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
          <h3 style={{ marginBottom: "10px", whiteSpace: "nowrap" }}>Matrix A</h3>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: `repeat(${matrixA[0].length}, 1fr)`,
              gap: "6px", // ✅ Adjusted for better fit
            }}
          >
            {matrixA.map((row, rowIndex) =>
              row.map((val, colIndex) => (
                <input
                  key={`${rowIndex}-${colIndex}`}
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={val || "0"} // ✅ Always show 0 by default
                  onChange={(e) =>
                    handleInputChange("A", rowIndex, colIndex, e.target.value === "" ? 0 : Number(e.target.value))
                  }
                  style={{
                    width: "45px", // ✅ Reduced size to fit within div
                    height: "45px",
                    padding: "5px",
                    fontSize: "16px", // ✅ Adjusted font for better readability
                    textAlign: "center",
                    borderRadius: "5px",
                    backgroundColor: "#1E1E1E",
                    color: "white",
                    outline: "none",
                  }}
                />
              ))
            )}
          </div>
        </div>

        {/* Matrix B */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
          <h3 style={{ marginBottom: "10px", whiteSpace: "nowrap" }}>Matrix B</h3>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: `repeat(${matrixB[0].length}, 1fr)`,
              gap: "6px", // ✅ Adjusted for better fit
            }}
          >
            {matrixB.map((row, rowIndex) =>
              row.map((val, colIndex) => (
                <input
                  key={`${rowIndex}-${colIndex}`}
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={val || "0"} // ✅ Always show 0 by default
                  onChange={(e) =>
                    handleInputChange("B", rowIndex, colIndex, e.target.value === "" ? 0 : Number(e.target.value))
                  }
                  style={{
                    width: "45px", // ✅ Reduced size to fit within div
                    height: "45px",
                    padding: "5px",
                    fontSize: "16px", // ✅ Adjusted font for better readability
                    textAlign: "center",
                    borderRadius: "5px",
                    backgroundColor: "#1E1E1E",
                    color: "white",
                    outline: "none",
                  }}
                />
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Element_DotProductInteractive;