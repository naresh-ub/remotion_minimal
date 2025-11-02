import { useCurrentFrame } from "remotion";
import { Latex } from "../../Latex";

export const MyCompositionDot: React.FC<{ matrixA: number[][]; matrixB: number[][] }> = ({
  matrixA,
  matrixB,
}) => {
  const frame = useCurrentFrame();
  const matrixSize = matrixA.length;

  // === SPACING CONTROL VARIABLES ===
  const paddingTop = 30; // Adjusts gap between top and explanation text
  const explanationMarginBottom = 60; // Space between explanation text and matrices
  const matricesMarginBottom = 30; // Space between matrices and the next section
  const equationMarginTop = 15; // Space between Matrix C and "C = A ⋅ B"
  const matrixGap = 60; // Controls the horizontal space between matrices

  // Frames for each computation step
  const framesPerComputation = 90;
  const pauseBetweenSteps = 40;
  const finalPauseFrames = 300; // 5 seconds hold

  // Total frames needed for animation
  const totalFrames = matrixSize * matrixSize * (framesPerComputation + pauseBetweenSteps) + finalPauseFrames;

  // Determine which computation step is currently happening
  let computationIndex = Math.floor(frame / (framesPerComputation + pauseBetweenSteps));
  let currentRow = Math.floor(computationIndex / matrixSize);
  let currentCol = computationIndex % matrixSize;
  let computationExpression = "";

  // Preserve previously computed values of C
  const matrixC: (string | number)[][] = Array(matrixSize)
    .fill(null)
    .map(() => Array(matrixSize).fill("?"));

  for (let i = 0; i < matrixSize; i++) {
    for (let j = 0; j < matrixSize; j++) {
      let sum = 0;
      for (let k = 0; k < matrixSize; k++) {
        sum += matrixA[i][k] * matrixB[k][j];
      }

      if (computationIndex < matrixSize * matrixSize) {
        // Normal computation: Highlight the current cell
        if (i === currentRow && j === currentCol) {
          matrixC[i][j] = `\\textcolor{gold}{${sum}}`;
        } else if (i < currentRow || (i === currentRow && j < currentCol)) {
          matrixC[i][j] = sum;
        }
      } else {
        // Final frame: Show all values in gold
        matrixC[i][j] = `\\textcolor{gold}{${sum}}`;
      }
    }
  }

  // Compute the current equation being solved
  if (computationIndex < matrixSize * matrixSize) {
    let sumSteps = [];
    let sum = 0;
    for (let k = 0; k < matrixSize; k++) {
      sumSteps.push(`(${matrixA[currentRow][k]} \\cdot ${matrixB[k][currentCol]})`);
      sum += matrixA[currentRow][k] * matrixB[k][currentCol];
    }
    computationExpression = `C_{(${currentRow + 1},${currentCol + 1})} = ${sumSteps.join(" + ")} = \\textbf{${sum}}`;
  }

  const formatMatrixForLatex = (matrix: (string | number)[][], highlightRow = -1, highlightCol = -1, disableHighlight = false) => {
    return `\\begin{bmatrix} ${matrix
      .map((row, i) =>
        row
          .map((val, j) => {
            if (!disableHighlight) {
              if (i === highlightRow) return `\\textcolor{pink}{${val}}`; // Highlight row in A
              if (j === highlightCol) return `\\textcolor{green}{${val}}`; // Highlight column in B
            }
            return val;
          })
          .join(" & ")
      )
      .join(" \\\\ ")} \\end{bmatrix}`;
  };

  return (
    <div style={{ background: "#1E1E1E", width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "flex-start", alignItems: "center", paddingTop: `${paddingTop}px` }}>
      
      <div style={{ 
    width: "80%", 
    maxWidth: "900px", 
    backgroundColor: "#2E2E2E", 
    borderRadius: "10px", 
    padding: "20px",
    border: "3px solid #00b4d8",
    boxShadow: "0px 4px 10px rgba(0, 180, 216, 0.6)",
    marginBottom: `${explanationMarginBottom}px`,
    display: "flex",
    flexDirection: "column"
  }}>
  
  {/* Title of the Formula Box */}
  <div style={{ 
      backgroundColor: "#006494", 
      color: "white", 
      padding: "10px 15px", 
      borderTopLeftRadius: "7px", 
      borderTopRightRadius: "7px",
      fontSize: "20px",
      fontWeight: "bold",
      width: "100%",
      textAlign: "center"
    }}>
    <Latex expression={`\\text{Dot Product}`}/>
  </div>

  {/* Explanation Text (Properly Left-Aligned) */}
  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", marginTop: "10px" }}> 
    <Latex expression={`\\textcolor{#00b4d8}{\\cdot \\text{ Given two } n \\times n \\text{ matrices,} \\text{each element } C_{i,j} \\text{ in their dot product}}`} fontSize={24} />
    <Latex expression={`\\textcolor{#00b4d8}{\\text{ matrix } C \\text{ is given by:}}`} fontSize={24} />
  </div>

  {/* Formula (Centered Separately) */}
  <div style={{ textAlign: "center", width: "100%", marginTop: "15px" }}>
    <Latex expression={`\\textcolor{gold}{C_{i,j} = \\sum_{k=1}^{n} A_{i,k} \\cdot B_{k,j}}`} fontSize={32} />
  </div>
</div>

      {/* Matrices Row */}
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: `${matrixGap}px`, marginBottom: `${matricesMarginBottom}px` }}>
        {/* Matrix A (Highlight Active Row) */}
        <Latex expression={`A = ${formatMatrixForLatex(matrixA, currentRow, -1)}`} fontSize={28} />

        {/* Dot Symbol */}
        <Latex expression={`\\cdot`} fontSize={40} />

        {/* Matrix B (Highlight Active Column, Disabled in Final Frame) */}
        <Latex expression={`B = ${formatMatrixForLatex(matrixB, -1, currentCol, computationIndex >= matrixSize * matrixSize)}`} fontSize={28} />

        {/* Equals Symbol */}
        <Latex expression="=" fontSize={40} />

        {/* Matrix C */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
          <Latex expression={`${formatMatrixForLatex(matrixC)}`} fontSize={28} />
        </div>
      </div>

      {/* Computation Step (Center Aligned Below) */}
      {computationExpression && computationIndex < matrixSize * matrixSize && (
        <div style={{ marginTop: `${equationMarginTop}px` }}>
          <Latex expression={computationExpression} fontSize={28} />
        </div>
      )}

      {/* Final Equation Below C */}
      <div style={{ marginTop: "10px" }}>
        <Latex expression={`C = A \\cdot B`} fontSize={32} />
      </div>
    </div>
  );
};