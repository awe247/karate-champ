import { Scene } from "phaser";
import { Socket } from "socket.io-client";
import { EventBus } from "../components/PhaserGame";

export class Fight extends Scene {
  roomKey: string = "";
  socket: Socket | undefined;
  background: Phaser.GameObjects.Image | undefined;

  constructor() {
    super("Fight");
  }

  init(data: { roomKey: string; socket: Socket }) {
    this.roomKey = data.roomKey;
    this.socket = data.socket;
  }

  preload() {
    this.load.image("background", "assets/bg.png");
    this.load.audio("ready-fight", "assets/audio/ready-fight.mp3");
    this.load.audio("fight-song", "assets/audio/fight.mp3");
  }

  create() {
    const scene = this;

    this.background = scene.add.image(0, 0, "background").setOrigin(0);
    this.cameras.main.fadeIn(500, 0, 0, 0);

    if (!this.sound.get("ready-fight")) {
      this.sound.play("ready-fight", { loop: false, volume: 0.3 });
    }

    EventBus.emit("current-scene-ready", this);
  }
}
