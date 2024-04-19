import { Scene } from "phaser";
import { Socket } from "socket.io-client";
import { EventBus } from "../components/PhaserGame";
import { Battle } from "../game/types";
import { createPlayerTexture } from "../game/utils";

export class Fight extends Scene {
  roomKey: string = "";
  socket: Socket | undefined;
  battle: Battle | undefined;
  background: Phaser.GameObjects.Image | undefined;
  readyTitle: Phaser.GameObjects.Image | undefined;
  readyTween: Phaser.Tweens.Tween | undefined;
  fightTitle: Phaser.GameObjects.Image | undefined;
  fightTween: Phaser.Tweens.Tween | undefined;
  player1Text: Phaser.GameObjects.Text | undefined;
  player2Text: Phaser.GameObjects.Text | undefined;
  player1Health: Phaser.GameObjects.Rectangle | undefined;
  player2Health: Phaser.GameObjects.Rectangle | undefined;
  timerText: Phaser.GameObjects.Text | undefined;
  player1Sprite: Phaser.GameObjects.Sprite | undefined;
  player2Sprite: Phaser.GameObjects.Sprite | undefined;

  constructor() {
    super("Fight");
  }

  init(data: { roomKey: string; socket: Socket; battle: Battle }) {
    this.roomKey = data.roomKey;
    this.socket = data.socket;
    this.battle = data.battle;
  }

  preload() {
    this.load.image("ready-title", "assets/readyTitle.png");
    this.load.image("fight-title", "assets/fightTitle.png");
    this.load.spritesheet("player", "assets/player-sheet.png", {
      frameWidth: 56,
      frameHeight: 56,
    });
    this.load.audio("ready-fight", "assets/audio/ready-fight.mp3");
  }

  create() {
    const scene = this;

    this.background = scene.add.image(0, 0, "background").setOrigin(0);
    this.cameras.main.fadeIn(500, 0, 0, 0);

    this.player1Text = scene.add
      .text(0, 0, this.battle?.player1.name ?? "Player 1", {
        backgroundColor: "#000000",
        color: "#ffffff",
        fontSize: "20px",
        fontStyle: "bold",
        fontFamily: "Tahoma, Verdana, sans-serif",
      })
      .setOrigin(0, 0);

    this.player2Text = scene.add
      .text(1024, 0, this.battle?.player2?.name ?? "CPU", {
        backgroundColor: "#000000",
        color: "#ffffff",
        fontSize: "20px",
        fontStyle: "bold",
        fontFamily: "Tahoma, Verdana, sans-serif",
      })
      .setOrigin(1, 0);

    this.add.rectangle(0, 30, 320, 30, 0xffff00).setOrigin(0, 0);
    this.player1Health = this.add
      .rectangle(320 - 10, 30, 10, 30, 0xff0000)
      .setOrigin(0, 0);
    this.add
      .rectangle(0, 30, 320, 30)
      .setStrokeStyle(2, 0x000000)
      .setOrigin(0, 0);

    this.add.rectangle(1024, 30, 320, 30, 0xffff00).setOrigin(1, 0);
    this.player2Health = this.add
      .rectangle(1024 - 320 + 10, 30, 10, 30, 0xff0000)
      .setOrigin(1, 0);
    this.add
      .rectangle(1024, 30, 320, 30)
      .setStrokeStyle(2, 0x000000)
      .setOrigin(1, 0);

    this.timerText = scene.add
      .text(512, 40, `${this.battle?.time ?? 0}`, {
        backgroundColor: "#000000",
        color: "#ffffff",
        fontSize: "60px",
        fontStyle: "bold",
        fontFamily: "Tahoma, Verdana, sans-serif",
      })
      .setOrigin(0.5, 0);

    if (this.battle?.player1) {
      createPlayerTexture(this, this.battle?.player1);
      this.player1Sprite = this.add
        .sprite(350, 550, this.battle?.player1.id, 0)
        .setScale(7);
      this.anims.create({
        key: "idle1",
        frames: this.anims.generateFrameNumbers(this.battle?.player1.id, {
          start: 0,
          end: 3,
        }),
        frameRate: 7,
        repeat: -1,
      });
    }

    createPlayerTexture(this, this.battle?.player2);
    this.player2Sprite = this.add
      .sprite(650, 550, this.battle?.player2?.id ?? "cpu", 0)
      .setScale(7)
      .setFlipX(true);
    this.anims.create({
      key: "idle2",
      frames: this.anims.generateFrameNumbers(
        this.battle?.player2?.id ?? "cpu",
        {
          start: 0,
          end: 3,
        }
      ),
      frameRate: 7,
      repeat: -1,
    });

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

  update() {
    this.player1Sprite?.anims.play("idle1", true);
    this.player2Sprite?.anims.play("idle2", true);
  }
}
