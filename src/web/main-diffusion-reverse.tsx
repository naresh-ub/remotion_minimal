import React from "react";
import { createRoot } from "react-dom/client";
import Element_DiffusionDDPM_Reverse from "../components/Element_DiffusionReverse";

const rootEl = document.getElementById("root");
if (!rootEl) throw new Error("#root not found");
createRoot(rootEl).render(<Element_DiffusionDDPM_Reverse />);
