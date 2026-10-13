import React from "react";
import ReactDOM from "react-dom/client";
import { AnalyticsHost } from "./AnalyticsHost.js";
import { App } from "./App.js";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AnalyticsHost><App /></AnalyticsHost>
  </React.StrictMode>
);
