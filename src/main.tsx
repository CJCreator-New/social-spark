import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { HelmetProvider } from "react-helmet-async";
import App from "./App.tsx";
import { initSentry } from "./lib/sentry";
import "./index.css";

function renderBootError(err: unknown) {
  const root = document.getElementById("root");
  if (!root) return;
  const message = err instanceof Error ? err.message : String(err);
  root.innerHTML = `
    <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;background:#07080d;color:#e6e6f0;font-family:Inter,system-ui,sans-serif;padding:24px;">
      <div style="max-width:480px;text-align:center;">
        <h1 style="font-size:22px;font-weight:600;margin:0 0 12px;">Something went wrong loading the app</h1>
        <p style="font-size:14px;opacity:0.75;margin:0 0 20px;">We hit an error while starting ContentForge. Please reload — if it keeps happening, clear your browser cache.</p>
        <button onclick="window.location.reload()" style="background:#3b82f6;color:white;border:none;padding:10px 18px;border-radius:8px;font-size:14px;font-weight:500;cursor:pointer;">Reload</button>
        <pre style="margin-top:20px;font-size:11px;opacity:0.5;white-space:pre-wrap;text-align:left;background:rgba(255,255,255,0.04);padding:10px;border-radius:6px;">${message.replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c]!))}</pre>
      </div>
    </div>
  `;
}

try {
  try {
    initSentry(import.meta.env.VITE_SENTRY_DSN as string | undefined);
  } catch (e) {
    console.warn("Sentry init failed", e);
  }

  const rootEl = document.getElementById("root");
  if (!rootEl) throw new Error("Root element #root not found");

  createRoot(rootEl).render(
    <StrictMode>
      <HelmetProvider>
        <App />
      </HelmetProvider>
    </StrictMode>
  );
} catch (err) {
  console.error("App bootstrap failed", err);
  renderBootError(err);
}
