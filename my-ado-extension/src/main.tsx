import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import * as AzureDevOpsSDK from "azure-devops-extension-sdk";
import "./index.css";
import App from "./App.tsx";

AzureDevOpsSDK.init().then(() =>
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <App />
    </StrictMode>
  )
);
