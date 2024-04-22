import { Scene } from "phaser";
import { Socket } from "socket.io-client";
import { EventBus } from "../components/PhaserGame";
import {
  Battle,
  BattleAttack,
  BattleDefend,
  BattleSequence,
  PlayerFrame,
} from "../game/types";
import { createPlayerTexture } from "../game/utils";

export class Fight extends Scene {
  roomKey: string = "";
  timerCount: number = 60;
  timer: NodeJS.Timeout | undefined;
  player1Moving: boolean = false;
  player1KO: boolean = false;
  player2Moving: boolean = false;
  player2KO: boolean = false;
  attackPicked: boolean = false;
  movesSent: boolean = false;
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
  winnerText: Phaser.GameObjects.Text | undefined;
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
    this.load.audio("punch-hit", "assets/audio/punch-hit.mp3");
    this.load.audio("punch-blocked", "assets/audio/punch-blocked.mp3");
    this.load.audio("punch-miss", "assets/audio/punch-miss.mp3");
    this.load.audio("ko", "assets/audio/ko.mp3");
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
      .rectangle(320, 30, 0, 30, 0xff0000)
      .setOrigin(0, 0);
    this.add
      .rectangle(0, 30, 320, 30)
      .setStrokeStyle(2, 0x000000)
      .setOrigin(0, 0);

    this.add.rectangle(1024, 30, 320, 30, 0xffff00).setOrigin(1, 0);
    this.player2Health = this.add
      .rectangle(1024 - 320, 30, 0, 30, 0xff0000)
      .setOrigin(1, 0);
    this.add
      .rectangle(1024, 30, 320, 30)
      .setStrokeStyle(2, 0x000000)
      .setOrigin(1, 0);

    this.timerText = scene.add
      .text(512, 40, `${scene.timerCount ?? 0}`, {
        backgroundColor: "#000000",
        color: "#ffffff",
        fontSize: "60px",
        fontStyle: "bold",
        fontFamily: "Tahoma, Verdana, sans-serif",
      })
      .setOrigin(0.5, 0);

    this.winnerText = scene.add
      .text(512, 300, "", {
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
        scene.sound.stopByKey("ready-fight");
        scene.sound.play("fight-song", { loop: true, volume: 0.1 });

        scene.timer = setInterval(() => {
          scene.timerCount--;
          scene.timerText?.setText(`${scene.timerCount}`);
          if (scene.timerCount <= 0) {
            clearInterval(scene.timer);
            const { roomKey } = scene;
            scene.socket?.emit("timesUp", { roomKey });
          }
        }, 1000);

        // create the input thought bubbles
        if (scene.battle?.player1.id === scene.socket?.id) {
          const ready = scene.add
            .image(512, 500, "ready")
            .setOrigin(0.5, 0)
            .setInteractive({ cursor: "pointer" })
            .on("pointerdown", () => {
              if (
                scene.timerCount > 0 &&
                !scene.player1KO &&
                !scene.player2KO &&
                !scene.movesSent
              ) {
                scene.movesSent = true;
                const { roomKey } = scene;
                scene.socket?.emit("sendMoves", {
                  roomKey,
                  attack: 3,
                  defend: 1,
                });
              }
            });
          ready.on("pointerover", () => {
            ready.setTint(0xcccccc);
          });
          ready.on("pointerout", () => {
            ready.clearTint();
          });
        }
      });
    });

    if (!this.sound.get("ready-fight")) {
      this.sound.play("ready-fight", { loop: false, volume: 0.3 });
    }

    this.socket?.on("battleUpdate", (args: { battleUpdate: Battle }) => {
      const { moves } = args.battleUpdate;

      if (!scene.player2KO && !scene.player1KO && moves.length > 0) {
        scene.move(
          moves[0],
          args.battleUpdate.player1.health,
          args.battleUpdate.player2?.health ??
            args.battleUpdate.cpuHealth ??
            100
        );

        scene.movesSent = moves.length > 0;

        if (!scene.player2KO && !scene.player1KO && moves.length > 1) {
          setTimeout(() => {
            scene.move(
              moves[1],
              args.battleUpdate.player1.health,
              args.battleUpdate.player2?.health ??
                args.battleUpdate.cpuHealth ??
                100
            );

            scene.movesSent = false;
          }, 2000);
        }
      }

      // if (this.timerText) {
      //   this.timerText.text = `${args.battle.time}`;
      // }
    });

    this.socket?.on("battleComplete", (args: { battle: Battle }) => {
      scene.timerCount = 0;
      scene.winnerText?.setText(`Time's up!`);
    });

    this.socket?.on(
      "showMatchups",
      (args: { rounds: []; currentRound: number; currentBattle: number }) => {
        const { roomKey, socket } = scene;
        const { rounds, currentRound, currentBattle } = args;
        scene.tweens.add({
          targets: scene.sound.get("fight-song"),
          volume: 0,
          duration: 500,
        });
        scene.cameras.main.fadeOut(500, 0, 0, 0);
        scene.cameras.main.once(
          Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE,
          () => {
            scene.sound.stopByKey("fight-song");
            scene.scene.stop("Fight");
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

    EventBus.emit("current-scene-ready", this);
  }

  update() {
    if (!this.player1Moving && !this.player1KO) {
      this.player1Sprite?.anims.play("idle1", true);
    }
    if (!this.player2Moving && !this.player2KO) {
      this.player2Sprite?.anims.play("idle2", true);
    }
  }

  move(sequence: BattleSequence, healthP1: number, healthP2: number) {
    const scene = this;
    const player1Attacking = sequence.playerId === scene.battle?.player1.id;
    const isBlock =
      (sequence.opponentResponse === BattleDefend.High &&
        sequence.attack === BattleAttack.High) ||
      (sequence.opponentResponse === BattleDefend.Mid &&
        sequence.attack === BattleAttack.Mid) ||
      (sequence.opponentResponse === BattleDefend.Low &&
        sequence.attack === BattleAttack.Low);
    const fxid = isBlock
      ? sequence.attack === BattleAttack.Low
        ? "punch-miss"
        : "punch-blocked"
      : "punch-hit";

    if (!scene.player2Moving) {
      scene.player2Moving = true;
      scene.player2Sprite?.anims.stop();
      if (player1Attacking) {
        if (scene.battle?.player2) {
          scene.battle.player2.health = healthP2;
        }
        if (healthP2 > 0) {
          if (isBlock) {
            switch (sequence.opponentResponse) {
              case BattleDefend.High:
                scene.player2Sprite?.setFrame(PlayerFrame.HighBlock);
                break;
              case BattleDefend.Mid:
                scene.player2Sprite?.setFrame(PlayerFrame.MidBlock);
                break;
              case BattleDefend.Low:
                scene.player2Sprite?.setFrame(PlayerFrame.LowMiss);
                break;
            }
          } else {
            switch (sequence.attack) {
              case BattleAttack.High:
                scene.player2Sprite?.setFrame(PlayerFrame.HighHit);
                break;
              case BattleAttack.Mid:
                scene.player2Sprite?.setFrame(PlayerFrame.MidHit);
                break;
              case BattleAttack.Low:
                scene.player2Sprite?.setFrame(PlayerFrame.MidHit);
                break;
            }
          }
        } else {
          scene.player2KO = true;
          scene.player2Sprite?.setFrame(PlayerFrame.KO);
        }
        if (isBlock) {
          setTimeout(() => {
            scene.player2Moving = false;
          }, 400);
        } else {
          const { x, y } = scene.player2Sprite ?? { x: 0 };
          const move2Tween = scene.tweens.add({
            targets: scene.player2Sprite,
            x: x + 100,
            y: y,
            duration: 300,
            ease: "Back.easeInOut",
            yoyo: true,
            repeat: 0,
            onComplete: () => {
              scene.player2Moving = false;
              move2Tween.destroy();
            },
          });
        }
        if (scene.player2Health) {
          const h2 = Math.round((100 - healthP2) * (320 / 100));
          scene.player2Health.x = 1024 - 320 + h2;
          scene.player2Health.width = h2;
          scene.player2Health.setOrigin(1, 0);
        }
      } else {
        switch (sequence.attack) {
          case BattleAttack.High:
            scene.player2Sprite?.setFrame(PlayerFrame.HighKick);
            break;
          case BattleAttack.Mid:
            scene.player2Sprite?.setFrame(PlayerFrame.MidKick);
            break;
          case BattleAttack.Low:
            scene.player2Sprite?.setFrame(PlayerFrame.LowPunch);
            break;
        }
        setTimeout(() => {
          scene.player2Moving = false;
        }, 400);
      }
    }

    scene.sound.play(fxid, { loop: false, volume: 0.3 });

    if (!scene.player1Moving) {
      scene.player1Moving = true;
      scene.player1Sprite?.anims.stop();
      scene.player1Sprite?.setFrame(9);
      if (!player1Attacking) {
        if (scene.battle?.player1) {
          scene.battle.player1.health = healthP1;
        }
        if (healthP1 > 0) {
          if (isBlock) {
            switch (sequence.opponentResponse) {
              case BattleDefend.High:
                scene.player1Sprite?.setFrame(PlayerFrame.HighBlock);
                break;
              case BattleDefend.Mid:
                scene.player1Sprite?.setFrame(PlayerFrame.MidBlock);
                break;
              case BattleDefend.Low:
                scene.player1Sprite?.setFrame(PlayerFrame.LowMiss);
                break;
            }
          } else {
            switch (sequence.attack) {
              case BattleAttack.High:
                scene.player1Sprite?.setFrame(PlayerFrame.HighHit);
                break;
              case BattleAttack.Mid:
                scene.player1Sprite?.setFrame(PlayerFrame.MidHit);
                break;
              case BattleAttack.Low:
                scene.player1Sprite?.setFrame(PlayerFrame.MidHit);
                break;
            }
          }
        } else {
          scene.player1KO = true;
          scene.player1Sprite?.setFrame(PlayerFrame.KO);
        }
        if (isBlock) {
          setTimeout(() => {
            scene.player1Moving = false;
          }, 400);
        } else {
          const { x, y } = scene.player1Sprite ?? { x: 0 };
          const move1Tween = scene.tweens.add({
            targets: scene.player1Sprite,
            x: x - 100,
            y: y,
            duration: 300,
            ease: "Back.easeInOut",
            yoyo: true,
            repeat: 0,
            onComplete: () => {
              scene.player1Moving = false;
              move1Tween.destroy();
            },
          });
        }
        if (scene.player1Health) {
          const h1 = Math.round((100 - healthP1) * (320 / 100));
          scene.player1Health.x = 320 - h1;
          scene.player1Health.width = h1;
        }
      } else {
        switch (sequence.attack) {
          case BattleAttack.High:
            scene.player1Sprite?.setFrame(PlayerFrame.HighKick);
            break;
          case BattleAttack.Mid:
            scene.player1Sprite?.setFrame(PlayerFrame.MidKick);
            break;
          case BattleAttack.Low:
            scene.player1Sprite?.setFrame(PlayerFrame.LowPunch);
            break;
        }
        setTimeout(() => {
          scene.player1Moving = false;
        }, 400);
      }
    }

    if (scene.player2KO || scene.player1KO) {
      scene.sound.play("ko", { loop: false, volume: 0.3 });

      const winner = scene.player1KO
        ? scene.battle?.player2?.name ?? "CPU"
        : scene.battle?.player1.name;
      scene.winnerText?.setText(`${winner} wins!`);
      clearInterval(scene.timer);
    }
  }
}
