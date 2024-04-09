import React from "react";
import ReactDOM from "react-dom/client";
import { SocketContext, socket } from "./socket";
import { App } from "./App";
import "./styles.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <SocketContext.Provider value={{ socket }}>
      <App />
    </SocketContext.Provider>
  </React.StrictMode>
);
