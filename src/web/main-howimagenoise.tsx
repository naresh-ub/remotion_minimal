import React from "react";
import { createRoot } from "react-dom/client";
import Element_HowImageNoise from "../components/Element_HowImageNoise";

const el = document.getElementById("root");
if (!el) throw new Error("#root not found");
createRoot(el).render(<Element_HowImageNoise />);
