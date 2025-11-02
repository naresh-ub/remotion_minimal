import React from "react";
import { createRoot } from "react-dom/client";
import Element_TrigVideoInteractive from "../components/Element_TrigVideoInteractive";

const rootEl = document.getElementById("root");
if (!rootEl) throw new Error("#root not found");
createRoot(rootEl).render(<Element_TrigVideoInteractive />);
