import React from "react";
import { createRoot } from "react-dom/client";
import Element_JigsawPuzzle from "../components/Element_JigsawPuzzle";

const rootEl = document.getElementById("root");
if (!rootEl) throw new Error("#root not found");
createRoot(rootEl).render(<Element_JigsawPuzzle />);
