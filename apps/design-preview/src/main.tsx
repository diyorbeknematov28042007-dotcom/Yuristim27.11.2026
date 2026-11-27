import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { LocaleProvider, ThemeProvider, YuristimMotionProvider } from "@yuristim/ui";
import { Catalog } from "./catalog";
import "./styles.css";

const root = document.querySelector<HTMLDivElement>("#root");
if (root === null) throw new Error("Design preview root is missing");

createRoot(root).render(
  <StrictMode>
    <ThemeProvider>
      <LocaleProvider>
        <YuristimMotionProvider>
          <Catalog />
        </YuristimMotionProvider>
      </LocaleProvider>
    </ThemeProvider>
  </StrictMode>,
);
