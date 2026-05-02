import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "./index.css";
import App from "./App";

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);

if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    const base = process.env.PUBLIC_URL || "";
    const swUrl = `${base}/service-worker.js`.replace(/\/{2,}/g, "/");
    navigator.serviceWorker.register(swUrl).catch(() => {});
  });
}
