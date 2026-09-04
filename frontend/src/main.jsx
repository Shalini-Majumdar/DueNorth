import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "@fontsource-variable/geist";

import App from "./App";
import Noise from "./components/Noise";
import { ToastProvider } from "./components/layout/Toast";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <ToastProvider>
        {/* static grain — gives the navy surfaces depth, drawn once, never animates */}
        <Noise alpha={11} opacity={0.032} />
        <App />
      </ToastProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
