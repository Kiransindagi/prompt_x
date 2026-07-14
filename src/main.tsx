import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import App from "./App";

import { registerGlobalTrigger } from "./core/invokeBotFromClipboard";

// Register System Hotkeys (Tauri Level)
// This handles Ctrl+P globally, even when the app is in the background.
if ((window as any).__TAURI_INTERNALS__) {
  registerGlobalTrigger();
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
