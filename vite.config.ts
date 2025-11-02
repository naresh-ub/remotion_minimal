// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  // Use a relative base so dist works from any folder or iframe subpath.
  base: "./",
  build: {
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: {
      // Build both HTML entry points
      input: {
        trig: resolve(__dirname, "trig.html"),
        dot: resolve(__dirname, "dot.html"),
        jigsaw: resolve(__dirname, "jigsaw.html"), // ← add this
        diffusion: resolve(__dirname, "diffusion.html"), // ← add this
        diffusion_reverse: resolve(__dirname, "diffusion-reverse.html"), // ← add this
        diffusion_forward_image: resolve(__dirname, "diffusion-forward-image.html"), // ← add this
        datasimulation: resolve(__dirname, "data-simulation.html"), // ← add this
        samplingcontinuous: resolve(__dirname, "sampling-continuous.html"), // ← add this
        howimagenoise: resolve(__dirname, "how-image-noise.html"), // ← add this
        forwardschedulers: resolve(__dirname, "diffusion-forward-schedulers.html"), // ← add this
      },
    },
  },
  server: {
    open: "/diffusion-forward-schedulers.html", // dev convenience
    port: 5173,
  },
}));
