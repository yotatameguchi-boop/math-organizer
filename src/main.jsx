import React from "react";
import { createRoot } from "react-dom/client";
import MathOrganizer from "./MathOrganizer.jsx";

document.body.style.margin = "0";
document.body.style.background = "#FAF8F2";

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <MathOrganizer />
  </React.StrictMode>
);
