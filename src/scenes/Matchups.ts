import { Scene } from "phaser";
import { Socket } from "socket.io-client";
import { EventBus, PlayerCollection } from "../components/PhaserGame";

export class Matchups extends Scene {
  roomKey: string = "";
  socket: Socket | undefined;

  constructor() {
    super("Matchups");
  }

  init(data: { roomKey: string; socket: Socket }) {
    this.roomKey = data.roomKey;
    this.socket = data.socket;
  }

  create() {
    const scene = this;

    this.cameras.main.fadeIn(1000, 0, 0, 0);

    EventBus.emit("current-scene-ready", this);
  }
}
