import { createContext } from "react";
import socketIOClient, { Socket } from "socket.io-client";

export const ENDPOINT = "http://localhost:8080"; // Update with your server's URL
export const socket = socketIOClient(ENDPOINT);
export const SocketContext = createContext<{ socket: Socket } | null>(null);
