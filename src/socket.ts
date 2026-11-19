import { createContext } from "react";
import socketIOClient, { Socket } from "socket.io-client";

// The page is served by the game server itself (server/index.js), so connect
// back to wherever it was loaded from: localhost in dev, the deployed host in
// production.
export const socket = socketIOClient();
export const SocketContext = createContext<{ socket: Socket } | null>(null);
