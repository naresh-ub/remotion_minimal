import React from "react";
import { createRoot } from "react-dom/client";
import Element_DiffusionDDPM from "../components/Element_DiffusionForward";

const el = document.getElementById("root");
if (!el) throw new Error("#root not found");
createRoot(el).render(<Element_DiffusionDDPM />);
