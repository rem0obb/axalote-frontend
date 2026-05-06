import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

import { ThemeProvider } from "./components/providers/ThemeProvider";
import { runtime } from "./lib/runtime";
import { initEngineBaseUrl } from "./lib/engine-config";

document.documentElement.dataset.runtime = runtime.isElectron ? "electron" : "web";

// Load persisted engine URL before rendering
initEngineBaseUrl().then(() => {
    createRoot(document.getElementById("root")!).render(
        <ThemeProvider defaultTheme="dark" storageKey="axalote-ui-theme">
            <App />
        </ThemeProvider>
    );
});
