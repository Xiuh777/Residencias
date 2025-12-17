import React from "react";
import { createRoot } from "react-dom/client";
import Html from "./html.jsx";
import "./index.css";

//  Variables del frontend (solo las que empiezan con VITE_)
const clientId = import.meta.env.VITE_SPOTIFY_CLIENT_ID;
const hasClientSecret = !!import.meta.env.VITE_SPOTIFY_CLIENT_SECRET; // solo para debug, no se usa en requests

console.log("Client ID present:", !!clientId);
console.log("Client Secret present:", hasClientSecret);

//  Render principal
createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <div className="app-wrapper">
      <Html clientId={clientId} hasClientSecret={hasClientSecret} />
    </div>
  </React.StrictMode>
);

