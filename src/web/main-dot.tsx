import React from "react";
import { createRoot } from "react-dom/client";
import Element_DotProductInteractive from "../components/Element_DotProductInteractive";

const rootEl = document.getElementById("root");
if (!rootEl) throw new Error("#root not found");
createRoot(rootEl).render(<Element_DotProductInteractive />);
