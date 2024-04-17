import { Scene } from "phaser";
import { Socket } from "socket.io-client";
import { EventBus, PlayerMap } from "../components/PhaserGame";

export class Main extends Scene {
  roomKey: string = "";
  socket: Socket | undefined;
  background: Phaser.GameObjects.Image | undefined;
  title: Phaser.GameObjects.Image | undefined;
  titleTween: Phaser.Tweens.Tween | undefined;
  roomKeyText: Phaser.GameObjects.Text | undefined;
  playerCountText: Phaser.GameObjects.Text | undefined;

  constructor() {
    super("Main");
  }

  init(data: { socket: Socket }) {
    this.socket = data.socket;
    this.add.rectangle(512, 384, 468, 32).setStrokeStyle(1, 0xffffff);

    const bar = this.add.rectangle(512 - 230, 384, 4, 28, 0xffffff);

    this.load.on("progress", (progress: number) => {
      bar.width = 4 + 460 * progress;
    });

    const scene = this;

    this.load.on("complete", () => {
      this.background = scene.add.image(0, 0, "background").setOrigin(0);
      this.title = scene.add.image(512, 384, "title").setOrigin(0.5);

      this.titleTween = scene.tweens.add({
        targets: scene.title,
        scale: { value: 1.3, duration: 700, ease: "Back.easeInOut" },
        yoyo: true,
        repeat: -1,
      });

      this.roomKeyText = scene.add
        .text(512, 300, "", {
          backgroundColor: "#000000",
          color: "#ffffff",
          fontSize: "60px",
          fontStyle: "bold",
          fontFamily: "Tahoma, Verdana, sans-serif",
        })
        .setOrigin(0.5, 0);

      this.playerCountText = scene.add
        .text(512, 400, "", {
          backgroundColor: "#000000",
          color: "#ffffff",
          fontSize: "40px",
          fontStyle: "bold",
          fontFamily: "Tahoma, Verdana, sans-serif",
        })
        .setOrigin(0.5, 0);

      EventBus.emit("current-scene-ready", this);
    });
  }

  preload() {
    this.load.image("background", "assets/bg.png");
    this.load.image("title", "assets/title.png");
    this.load.image("ready", "assets/ready.png");
    this.load.audio("matchups-song", "assets/audio/matchups.mp3");
    this.load.audio("fight-song", "assets/audio/fight.mp3");
  }

  create() {
    const scene = this;

    this.socket?.on(
      "roomCreated",
      (args: { roomKey: string; players: PlayerMap }) => {
        scene.titleTween?.stop();
        scene.titleTween?.destroy();
        scene.title?.destroy();
        scene.roomKey = args.roomKey;
        scene.roomKeyText?.setText(`CODE: ${scene.roomKey}`);
        scene.playerCountText?.setText(
          `PLAYERS: ${Object.keys(args.players).length}`
        );
        const ready = scene.add.image(512, 500, "ready").setOrigin(0.5, 0);
        ready.setInteractive({ cursor: "pointer" });
        ready.on("pointerdown", () => {
          const { roomKey } = scene;
          scene.socket?.emit("startGame", { roomKey });
        });
      }
    );

    this.socket?.on(
      "roomJoined",
      (args: { roomKey: string; players: PlayerMap }) => {
        scene.titleTween?.stop();
        scene.titleTween?.destroy();
        scene.title?.destroy();
        scene.roomKey = args.roomKey;
        scene.roomKeyText?.setText(`CODE: ${scene.roomKey}`);
        scene.playerCountText?.setText(
          `PLAYERS: ${Object.keys(args.players).length}`
        );
      }
    );

    this.socket?.on("roomUpdate", (args: { players: PlayerMap }) => {
      scene.playerCountText?.setText(
        `PLAYERS: ${Object.keys(args.players).length}`
      );
    });

    this.socket?.on(
      "showMatchups",
      (args: { rounds: []; currentRound: number; currentBattle: number }) => {
        const { roomKey, socket } = scene;
        const { rounds, currentRound, currentBattle } = args;
        scene.cameras.main.fadeOut(500, 0, 0, 0);
        scene.cameras.main.once(
          Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE,
          () => {
            scene.scene.start("Matchups", {
              roomKey,
              socket,
              rounds,
              currentRound,
              currentBattle,
            });
          }
        );
      }
    );
  }
}
