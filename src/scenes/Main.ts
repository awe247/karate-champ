import { Scene } from "phaser";
import { Socket } from "socket.io-client";
import { EventBus } from "../components/PhaserGame";

export class Main extends Scene {
  background: Phaser.GameObjects.Image | undefined;
  title: Phaser.GameObjects.Image | undefined;
  titleTween: Phaser.Tweens.Tween | undefined;
  socket: Socket | undefined;

  constructor() {
    super("Main");
  }

  init(data: { socket: Socket }) {
    this.socket = data.socket;
  }

  preload() {
    this.load.image("background", "assets/bg.png");
    this.load.image("title", "assets/title.png");
  }

  create() {
    const scene = this;

    this.background = scene.add.image(0, 0, "background").setOrigin(0);
    this.title = scene.add.image(512, 384, "title").setOrigin(0.5);

    this.titleTween = scene.tweens.add({
      targets: scene.title,
      scale: { value: 1.3, duration: 700, ease: "Back.easeInOut" },
      yoyo: true,
      repeat: -1,
    });

    EventBus.emit("current-scene-ready", this);

    this.socket?.on("roomCreated", (roomKey: string) => {
      scene.titleTween?.destroy();
      scene.title?.destroy();
      // scene.roomKey = roomKey;
      // scene.roomKeyText.setText(scene.roomKey);
    });
  }
}
