import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import { dropLegacyKeys } from "./lib/storage";
import "./lib/prefs";
import "./styles/global.css";

// prefs migrates the old birthday on import; the rest of the v1 cache can go.
dropLegacyKeys();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
