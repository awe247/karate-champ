import { Scene } from "phaser";
import { Socket } from "socket.io-client";
import { EventBus, RoundResult } from "../components/PhaserGame";

export class Matchups extends Scene {
  roomKey: string = "";
  rounds: RoundResult[] = [];
  currentRound: number = 0;
  currentBattle: number = 0;
  socket: Socket | undefined;
  background2: Phaser.GameObjects.Image | undefined;
  graphics: Phaser.GameObjects.Graphics | undefined;

  constructor() {
    super("Matchups");
  }

  init(data: {
    roomKey: string;
    socket: Socket;
    rounds: [];
    currentRound: number;
    currentBattle: number;
  }) {
    this.roomKey = data.roomKey;
    this.socket = data.socket;
    this.rounds = data.rounds;
    this.currentRound = data.currentRound;
    this.currentBattle = data.currentBattle;
  }

  preload() {
    this.load.image("background2", "assets/bg2.png");
    this.load.audio("matchups-song", "assets/audio/matchups.mp3");
  }

  create() {
    const scene = this;

    this.background2 = scene.add.image(0, 0, "background2").setOrigin(0);
    this.cameras.main.fadeIn(500, 0, 0, 0);

    if (!this.sound.get("matchups-song")) {
      this.sound.play("matchups-song", { loop: true, volume: 0.3 });
    }

    this.graphics = this.add.graphics();
    this.graphics.lineStyle(2, 0x000000, 1);

    this.rounds.forEach((round, idx) => {
      const xPos = 512 + idx * 400 - this.currentRound * 400;
      scene.add
        .text(xPos, 40, round.name, {
          color: "#ffffff",
          fontSize: "40px",
          fontStyle: "bold",
          fontFamily: "Tahoma, Verdana, sans-serif",
        })
        .setOrigin(0.5, 0);

      round.battles.forEach((battle, idy) => {
        let yPos = 100 + idy * 40;
        const yOffset = idy - scene.currentBattle + 7;
        if (scene.currentRound == idx && scene.currentBattle > 7) {
          yPos = 100 + yOffset * 40;
        }
        if (scene.currentRound != idx || yOffset >= 0) {
          scene.graphics?.fillStyle(
            getBgColor(idx, scene.currentRound, idy, scene.currentBattle)
          );
          scene.graphics?.fillRoundedRect(xPos - 190, yPos - 4, 380, 30, 16);
          scene.graphics?.strokeRoundedRect(xPos - 190, yPos - 4, 380, 30, 16);
          scene.add
            .text(xPos, yPos, battle, {
              backgroundColor: getBackgroundColor(
                idx,
                scene.currentRound,
                idy,
                scene.currentBattle
              ),
              color:
                idx == scene.currentRound && idy == scene.currentBattle
                  ? "#ffffff"
                  : "#000000",
              fontSize: "20px",
              fontFamily: "Tahoma, Verdana, sans-serif",
            })
            .setOrigin(0.5, 0);
        }
      });
    });

    this.socket?.on("fight", () => {
      scene.tweens.add({
        targets: scene.sound.get("matchups-song"),
        volume: 0,
        duration: 500,
      });
      scene.cameras.main.fadeOut(500, 0, 0, 0);
      scene.cameras.main.once(
        Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE,
        () => {
          scene.scene.start("Fight", {});
        }
      );
    });

    EventBus.emit("current-scene-ready", this);
  }
}

function getBgColor(r: number, cr: number, b: number, cb: number): number {
  if (r == cr && b == cb) {
    return 0xff00ff;
  }
  if (r < cr || (r == cr && b < cb)) {
    return 0xa1a1a1;
  }
  return 0xffffff;
}

function getBackgroundColor(
  r: number,
  cr: number,
  b: number,
  cb: number
): string {
  if (r == cr && b == cb) {
    return "#ff00ff";
  }
  if (r < cr || (r == cr && b < cb)) {
    return "#a1a1a1";
  }
  return "#ffffff";
}
