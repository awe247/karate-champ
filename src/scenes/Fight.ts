import { Scene } from "phaser";
import { Socket } from "socket.io-client";
import { EventBus } from "../components/PhaserGame";

export class Fight extends Scene {
  roomKey: string = "";
  socket: Socket | undefined;
  background: Phaser.GameObjects.Image | undefined;
  readyTitle: Phaser.GameObjects.Image | undefined;
  readyTween: Phaser.Tweens.Tween | undefined;
  fightTitle: Phaser.GameObjects.Image | undefined;
  fightTween: Phaser.Tweens.Tween | undefined;

  constructor() {
    super("Fight");
  }

  init(data: { roomKey: string; socket: Socket }) {
    this.roomKey = data.roomKey;
    this.socket = data.socket;
  }

  preload() {
    this.load.image("background", "assets/bg.png");
    this.load.image("ready-title", "assets/readyTitle.png");
    this.load.image("fight-title", "assets/fightTitle.png");
    this.load.audio("ready-fight", "assets/audio/ready-fight.mp3");
    this.load.audio("fight-song", "assets/audio/fight.mp3");
  }

  create() {
    const scene = this;

    this.background = scene.add.image(0, 0, "background").setOrigin(0);
    this.cameras.main.fadeIn(500, 0, 0, 0);

    this.readyTitle = scene.add.image(512, 384, "ready-title").setOrigin(0.5);
    this.readyTween = scene.tweens.add({
      targets: scene.readyTitle,
      scale: { value: 3.0, duration: 700, ease: "Back.easeInOut" },
      yoyo: true,
      repeat: 0,
    });
    this.readyTween.on("complete", () => {
      scene.readyTween?.stop();
      scene.readyTitle?.destroy();
      scene.fightTitle = scene.add
        .image(512, 384, "fight-title")
        .setOrigin(0.5);
      scene.fightTween = scene.tweens.add({
        targets: scene.fightTitle,
        scale: { value: 3.0, duration: 700, ease: "Back.easeInOut" },
        yoyo: true,
        repeat: 0,
      });
      scene.fightTween.on("complete", () => {
        scene.fightTween?.stop();
        scene.fightTitle?.destroy();
        scene.sound.stopAll();
        if (!scene.sound.get("fight-song")) {
          this.sound.play("fight-song", { loop: true, volume: 0.1 });
        }
      });
    });
    if (!this.sound.get("ready-fight")) {
      this.sound.play("ready-fight", { loop: false, volume: 0.3 });
    }

    EventBus.emit("current-scene-ready", this);
  }
}
