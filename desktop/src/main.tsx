import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { initPaths } from "./lib/paths";
import "@stillmvd/tauri-ship/ship.css";
import "./styles.css";

await initPaths();

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

const SPLASH_MIN_MS = 1000;
const SPLASH_FADE_MS = 340;
const splash = document.getElementById("splash");
if (splash) {
  window.setTimeout(
    () => {
      splash.classList.add("splash-out");
      window.setTimeout(() => splash.remove(), SPLASH_FADE_MS);
    },
    Math.max(0, SPLASH_MIN_MS - performance.now()),
  );
}
