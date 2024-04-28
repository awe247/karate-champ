import { Scene } from "phaser";
import { Socket } from "socket.io-client";
import { EventBus } from "../components/PhaserGame";
import {
  Battle,
  BattleAttack,
  BattleDefend,
  BattleSequence,
  PlayerFrame,
  RoundResult,
} from "../game/types";
import { createPlayerTexture } from "../game/utils";

interface GameUpdate {
  rounds: RoundResult[];
  currentRound: number;
  currentBattle: number;
  battle: Battle;
  winner?: string;
  waiting?: boolean;
}

export class Fight extends Scene {
  roomKey: string = "";
  timerCount: number = 60;
  timer: NodeJS.Timeout | undefined;
  player1Moving: boolean = false;
  player1KO: boolean = false;
  player2Moving: boolean = false;
  player2KO: boolean = false;
  ready: boolean = false;
  waiting: boolean = true;
  attackPicked: BattleAttack = BattleAttack.None;
  movesSent: boolean = false;
  rounds: RoundResult[] = [];
  currentRound: number = 0;
  currentBattle: number = 0;
  battle: Battle | undefined;
  socket: Socket | undefined;
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
  p1HealthBar: Phaser.GameObjects.Group | undefined;
  p2HealthBar: Phaser.GameObjects.Group | undefined;
  p1ThoughtBubble: Phaser.GameObjects.Group | undefined;
  p1ThoughtEllipsis: Phaser.GameObjects.Image | undefined;
  p1ThoughtText: Phaser.GameObjects.Text | undefined;
  p1ThoughtAttack: Phaser.GameObjects.Image | undefined;
  p1ThoughtDefend: Phaser.GameObjects.Image | undefined;
  p1MoveHigh: Phaser.GameObjects.Image | undefined;
  p1MoveMid: Phaser.GameObjects.Image | undefined;
  p1MoveLow: Phaser.GameObjects.Image | undefined;
  p2ThoughtBubble: Phaser.GameObjects.Group | undefined;
  p2ThoughtEllipsis: Phaser.GameObjects.Image | undefined;
  p2ThoughtText: Phaser.GameObjects.Text | undefined;
  p2ThoughtAttack: Phaser.GameObjects.Image | undefined;
  p2ThoughtDefend: Phaser.GameObjects.Image | undefined;
  p2MoveHigh: Phaser.GameObjects.Image | undefined;
  p2MoveMid: Phaser.GameObjects.Image | undefined;
  p2MoveLow: Phaser.GameObjects.Image | undefined;
  fxReadyFight: Phaser.Sound.BaseSound | undefined;
  fxFightSong: Phaser.Sound.BaseSound | undefined;
  readyButton: Phaser.GameObjects.Image | undefined;

  constructor() {
    super("Fight");
  }

  init(data: {
    roomKey: string;
    socket: Socket;
    rounds: RoundResult[];
    currentRound: number;
    currentBattle: number;
    battle: Battle;
    timerCount: number;
  }) {
    this.roomKey = data.roomKey;
    this.socket = data.socket;
    this.rounds = data.rounds;
    this.currentRound = data.currentRound;
    this.currentBattle = data.currentBattle;
    this.battle = data.battle;
    this.timerCount = data.battle.time;

    const { roomKey } = data;
    document.addEventListener("visibilitychange", () => {
      console.log(`visibilitychange: ${document.visibilityState}`);
      if (document.visibilityState === "visible") {
        this.socket?.emit("needUpdate", { roomKey });
        this.socket?.on("ready", this.handleReady);
        this.socket?.on("moveUpdate", this.handleMove);
        this.socket?.on("battleUpdate", this.handleBattle);
        this.socket?.on("next", this.handleNext);
      } else {
        this.socket?.off("ready");
        this.socket?.off("moveUpdate");
        this.socket?.off("battleUpdate");
        this.socket?.off("next");
      }
    });
  }

  preload() {
    this.load.image("ready-title", "assets/readyTitle.png");
    this.load.image("fight-title", "assets/fightTitle.png");
    this.load.image("thought-bubble", "assets/thoughtBubble.png");
    this.load.image("ellipsis", "assets/ellipsis.png");
    this.load.image("arrow-low", "assets/arrow-low.png");
    this.load.image("arrow-mid", "assets/arrow-mid.png");
    this.load.image("arrow-high", "assets/arrow-high.png");
    this.load.image("fist", "assets/fist.png");
    this.load.image("shield", "assets/shield.png");
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
    this.sound.pauseOnBlur = false;

    const scene = this;

    this.waiting = false;
    this.ready = false;
    this.attackPicked = BattleAttack.None;
    this.movesSent = false;
    this.player1KO = false;
    this.player2KO = false;

    this.background = scene.add.image(0, 0, "background").setOrigin(0);
    this.cameras.main.fadeIn(500, 0, 0, 0);

    this.player1Text = scene.add
      .text(0, 0, "", {
        backgroundColor: "#000000",
        color: "#ffffff",
        fontSize: "20px",
        fontStyle: "bold",
        fontFamily: "Tahoma, Verdana, sans-serif",
      })
      .setOrigin(0, 0);

    this.player2Text = scene.add
      .text(1024, 0, "", {
        backgroundColor: "#000000",
        color: "#ffffff",
        fontSize: "20px",
        fontStyle: "bold",
        fontFamily: "Tahoma, Verdana, sans-serif",
      })
      .setOrigin(1, 0);

    this.p1HealthBar = this.add.group();
    this.p1HealthBar.add(
      this.add.rectangle(0, 30, 320, 30, 0xffff00).setOrigin(0, 0)
    );
    this.player1Health = this.add
      .rectangle(320, 30, 0, 30, 0xff0000)
      .setOrigin(0, 0);
    this.p1HealthBar.add(this.player1Health);
    this.p1HealthBar.add(
      this.add
        .rectangle(0, 30, 320, 30)
        .setStrokeStyle(2, 0x000000)
        .setOrigin(0, 0)
    );
    this.p1HealthBar.setVisible(false);

    this.p2HealthBar = this.add.group();
    this.p2HealthBar.add(
      this.add.rectangle(1024, 30, 320, 30, 0xffff00).setOrigin(1, 0)
    );
    this.player2Health = this.add
      .rectangle(1024 - 320, 30, 0, 30, 0xff0000)
      .setOrigin(1, 0);
    this.p2HealthBar.add(this.player2Health);
    this.p2HealthBar.add(
      this.add
        .rectangle(1024, 30, 320, 30)
        .setStrokeStyle(2, 0x000000)
        .setOrigin(1, 0)
    );
    this.p2HealthBar.setVisible(false);

    this.timerText = scene.add
      .text(512, 40, "", {
        backgroundColor: "#000000",
        color: "#ffffff",
        fontSize: "60px",
        fontStyle: "bold",
        fontFamily: "Tahoma, Verdana, sans-serif",
      })
      .setOrigin(0.5, 0)
      .setVisible(false);

    this.winnerText = scene.add
      .text(512, 300, "Waiting...", {
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
        .setScale(7)
        .setVisible(false);
      this.anims.create({
        key: `${this.battle?.player1.id}-idle`,
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
      .setFlipX(true)
      .setVisible(false);
    this.anims.create({
      key: `${this.battle?.player2?.id ?? "cpu"}-idle`,
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

    this.fxReadyFight = this.sound.add("ready-fight", {
      loop: false,
      volume: 0.3,
    });
    this.fxFightSong = this.sound.add("fight-song", {
      loop: true,
      volume: 0.1,
    });

    this.readyTitle = scene.add
      .image(512, 384, "ready-title")
      .setOrigin(0.5)
      .setVisible(false);
    this.fightTitle = scene.add
      .image(512, 384, "fight-title")
      .setOrigin(0.5)
      .setVisible(false);

    this.readyTween = scene.tweens.add({
      targets: scene.readyTitle,
      scale: { value: 3.0, duration: 700, ease: "Back.easeInOut" },
      yoyo: true,
      repeat: 10,
      paused: true,
    });
    this.fightTween = scene.tweens.add({
      targets: scene.fightTitle,
      scale: { value: 3.0, duration: 700, ease: "Back.easeInOut" },
      yoyo: true,
      repeat: 10,
      paused: true,
    });

    this.readyTween.on("repeat", () => {
      scene.readyTween?.pause();
      scene.readyTitle?.setVisible(false);
      scene.fightTitle?.setVisible(true);
      scene.fightTween?.play();
    });
    this.fightTween.on("repeat", () => {
      scene.fightTween?.pause();
      scene.fightTitle?.setVisible(false);
      //scene.fxFightSong?.play();
      scene.ready = true;
    });

    // create the input thought bubbles
    this.p1ThoughtBubble = scene.add.group();
    this.p1ThoughtBubble.add(
      scene.add.image(250, 300, "thought-bubble").setVisible(false).setScale(7)
    );
    this.p1ThoughtText = scene.add
      .text(245, 170, "CHOOSE...", {
        backgroundColor: "#ffffff",
        color: "#000000",
        fontSize: "16px",
        fontStyle: "bold",
        fontFamily: "Tahoma, Verdana, sans-serif",
      })
      .setOrigin(0.5)
      .setVisible(false);
    this.p1ThoughtBubble.add(this.p1ThoughtText);
    this.p1ThoughtEllipsis = scene.add
      .image(245, 265, "ellipsis")
      .setAlpha(1.0)
      .setVisible(false);
    scene.tweens.add({
      targets: this.p1ThoughtEllipsis,
      alpha: { value: 0.4, duration: 700 },
      yoyo: true,
      repeat: -1,
    });
    this.p1ThoughtAttack = scene.add.image(220, 270, "fist").setVisible(false);
    this.p1ThoughtDefend = scene.add
      .image(220, 270, "shield")
      .setVisible(false);
    this.p1ThoughtBubble.add(this.p1ThoughtEllipsis);
    this.p1ThoughtBubble.add(this.p1ThoughtAttack);
    this.p1ThoughtBubble.add(this.p1ThoughtDefend);
    this.p1MoveHigh = scene.add
      .image(280, 220, "arrow-high")
      .setInteractive({ cursor: "pointer" })
      .setVisible(false)
      .on("pointerdown", () => {
        if (
          scene.timerCount > 0 &&
          !scene.player1KO &&
          !scene.player2KO &&
          !scene.player1Moving &&
          !scene.player2Moving &&
          !scene.movesSent
        ) {
          scene.p1MoveHigh?.setTint(0x00ff00);
          scene.handleInput(BattleAttack.High, BattleDefend.High);
        }
      });
    this.p1MoveHigh.on("pointerover", () => {
      scene.p1MoveHigh?.setTint(0xcccccc);
    });
    this.p1MoveHigh.on("pointerout", () => {
      scene.p1MoveHigh?.clearTint();
    });
    this.p1MoveHigh.on("pointerup", () => {
      setTimeout(() => {
        scene.p1MoveHigh?.clearTint();
      }, 300);
    });
    this.p1ThoughtBubble.add(this.p1MoveHigh);
    this.p1MoveMid = scene.add
      .image(280, 270, "arrow-mid")
      .setInteractive({ cursor: "pointer" })
      .setVisible(false)
      .on("pointerdown", () => {
        if (
          scene.timerCount > 0 &&
          !scene.player1KO &&
          !scene.player2KO &&
          !scene.player1Moving &&
          !scene.player2Moving &&
          !scene.movesSent
        ) {
          scene.p1MoveMid?.setTint(0x00ff00);
          scene.handleInput(BattleAttack.Mid, BattleDefend.Mid);
        }
      });
    this.p1MoveMid.on("pointerover", () => {
      scene.p1MoveMid?.setTint(0xcccccc);
    });
    this.p1MoveMid.on("pointerout", () => {
      scene.p1MoveMid?.clearTint();
    });
    this.p1MoveMid.on("pointerup", () => {
      setTimeout(() => {
        scene.p1MoveMid?.clearTint();
      }, 300);
    });
    this.p1ThoughtBubble.add(this.p1MoveMid);
    this.p1MoveLow = scene.add
      .image(280, 320, "arrow-low")
      .setInteractive({ cursor: "pointer" })
      .setVisible(false)
      .on("pointerdown", () => {
        if (
          scene.timerCount > 0 &&
          !scene.player1KO &&
          !scene.player2KO &&
          !scene.player1Moving &&
          !scene.player2Moving &&
          !scene.movesSent
        ) {
          scene.p1MoveLow?.setTint(0x00ff00);
          scene.handleInput(BattleAttack.Low, BattleDefend.Low);
        }
      });
    this.p1MoveLow.on("pointerover", () => {
      scene.p1MoveLow?.setTint(0xcccccc);
    });
    this.p1MoveLow.on("pointerout", () => {
      scene.p1MoveLow?.clearTint();
    });
    this.p1MoveLow.on("pointerup", () => {
      setTimeout(() => {
        scene.p1MoveLow?.clearTint();
      }, 300);
    });
    this.p1ThoughtBubble.add(this.p1MoveLow);
    this.p1ThoughtBubble.setVisible(false);

    this.p2ThoughtBubble = scene.add.group();
    this.p2ThoughtBubble.add(
      scene.add.image(750, 300, "thought-bubble").setScale(7).setFlipX(true)
    );
    this.p2ThoughtText = scene.add
      .text(755, 170, "CHOOSE...", {
        backgroundColor: "#ffffff",
        color: "#000000",
        fontSize: "16px",
        fontStyle: "bold",
        fontFamily: "Tahoma, Verdana, sans-serif",
      })
      .setOrigin(0.5)
      .setVisible(false);
    this.p2ThoughtBubble.add(this.p2ThoughtText);
    this.p2ThoughtEllipsis = scene.add
      .image(755, 265, "ellipsis")
      .setAlpha(1.0)
      .setVisible(false);
    scene.tweens.add({
      targets: this.p2ThoughtEllipsis,
      alpha: { value: 0.4, duration: 700 },
      yoyo: true,
      repeat: -1,
    });
    this.p2ThoughtAttack = scene.add.image(780, 270, "fist").setVisible(false);
    this.p2ThoughtDefend = scene.add
      .image(780, 270, "shield")
      .setVisible(false);
    this.p2ThoughtBubble.add(this.p2ThoughtEllipsis);
    this.p2ThoughtBubble.add(this.p2ThoughtAttack);
    this.p2ThoughtBubble.add(this.p2ThoughtDefend);
    this.p2MoveHigh = scene.add
      .image(720, 220, "arrow-high")
      .setFlipX(true)
      .setInteractive({ cursor: "pointer" })
      .setVisible(false)
      .on("pointerdown", () => {
        if (
          scene.timerCount > 0 &&
          !scene.player1KO &&
          !scene.player2KO &&
          !scene.player1Moving &&
          !scene.player2Moving &&
          !scene.movesSent
        ) {
          scene.p2MoveHigh?.setTint(0x00ff00);
          scene.handleInput(BattleAttack.High, BattleDefend.High);
        }
      });
    this.p2MoveHigh.on("pointerover", () => {
      scene.p2MoveHigh?.setTint(0xcccccc);
    });
    this.p2MoveHigh.on("pointerout", () => {
      scene.p2MoveHigh?.clearTint();
    });
    this.p2MoveHigh.on("pointerup", () => {
      setTimeout(() => {
        scene.p2MoveHigh?.clearTint();
      }, 300);
    });
    this.p2ThoughtBubble.add(this.p2MoveHigh);
    this.p2MoveMid = scene.add
      .image(720, 270, "arrow-mid")
      .setFlipX(true)
      .setInteractive({ cursor: "pointer" })
      .setVisible(false)
      .on("pointerdown", () => {
        if (
          scene.timerCount > 0 &&
          !scene.player1KO &&
          !scene.player2KO &&
          !scene.player1Moving &&
          !scene.player2Moving &&
          !scene.movesSent
        ) {
          scene.p2MoveMid?.setTint(0x00ff00);
          scene.handleInput(BattleAttack.Mid, BattleDefend.Mid);
        }
      });
    this.p2MoveMid.on("pointerover", () => {
      scene.p2MoveMid?.setTint(0xcccccc);
    });
    this.p2MoveMid.on("pointerout", () => {
      scene.p2MoveMid?.clearTint();
    });
    this.p2MoveMid.on("pointerup", () => {
      setTimeout(() => {
        scene.p2MoveMid?.clearTint();
      }, 300);
    });
    this.p2ThoughtBubble.add(this.p2MoveMid);
    this.p2MoveLow = scene.add
      .image(720, 320, "arrow-low")
      .setFlipX(true)
      .setInteractive({ cursor: "pointer" })
      .setVisible(false)
      .on("pointerdown", () => {
        if (
          scene.timerCount > 0 &&
          !scene.player1KO &&
          !scene.player2KO &&
          !scene.player1Moving &&
          !scene.player2Moving &&
          !scene.movesSent
        ) {
          scene.p2MoveLow?.setTint(0x00ff00);
          scene.handleInput(BattleAttack.Low, BattleDefend.Low);
        }
      });
    this.p2MoveLow.on("pointerover", () => {
      scene.p2MoveLow?.setTint(0xcccccc);
    });
    this.p2MoveLow.on("pointerout", () => {
      scene.p2MoveLow?.clearTint();
    });
    this.p2MoveLow.on("pointerup", () => {
      setTimeout(() => {
        scene.p2MoveLow?.clearTint();
      }, 300);
    });
    this.p2ThoughtBubble.add(this.p2MoveLow);
    this.p2ThoughtBubble.setVisible(false);

    this.readyButton = this.add
      .image(512, 500, "ready")
      .setOrigin(0.5, 0)
      .setInteractive({ cursor: "pointer" })
      .setVisible(false)
      .on("pointerdown", () => {
        const { roomKey, currentRound, currentBattle } = scene;
        scene.ready = false;
        scene.waiting = true;
        scene.readyButton?.setVisible(false);
        scene.winnerText?.setText("Waiting...");
        //scene.fxFightSong?.pause();
        scene.p1HealthBar?.setVisible(false);
        scene.p2HealthBar?.setVisible(false);
        scene.player1Text?.setText("");
        scene.player2Text?.setText("");
        scene.player1Sprite?.setVisible(false);
        scene.player2Sprite?.setVisible(false);
        scene.p1ThoughtBubble?.setVisible(false);
        scene.p2ThoughtBubble?.setVisible(false);
        scene.timerText?.setVisible(false);
        scene.socket?.emit("sendNext", {
          roomKey,
          currentRound,
          currentBattle,
        });
      });
    this.readyButton.on("pointerover", () => {
      scene.readyButton?.setTint(0xcccccc);
    });
    this.readyButton.on("pointerout", () => {
      scene.readyButton?.clearTint();
    });

    // this.socket?.on(
    //   "showMatchups",
    //   async (args: {
    //     rounds: [];
    //     currentRound: number;
    //     currentBattle: number;
    //   }) => {
    //     const { roomKey, socket } = scene;
    //     const { rounds, currentRound, currentBattle } = args;
    //     scene.cameras.main.fadeOut(500, 0, 0, 0);
    //     scene.cameras.main.once(
    //       Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE,
    //       () => {
    //         scene.anims.remove("idle1");
    //         scene.anims.remove("idle2");
    //         scene.sound.stopByKey("fight-song");
    //         scene.scene.stop("Fight");
    //         scene.scene.start("Matchups", {
    //           roomKey,
    //           socket,
    //           rounds,
    //           currentRound,
    //           currentBattle,
    //         });
    //       }
    //     );
    //   }
    // );

    this.socket?.on("ready", this.handleReady);

    this.socket?.on("next", this.handleNext);

    this.socket?.on("timeUpdate", this.handleTimeUpdate);

    this.socket?.on("moveUpdate", this.handleMove);

    this.socket?.on("battleUpdate", this.handleBattle);

    this.socket?.on("gameUpdate", this.handleGameUpdate);

    this.socket?.on("gameOver", (args: { rounds: RoundResult[] }) => {
      const { rounds } = args;
      const { roomKey, socket } = this;
      this.cameras.main.fadeOut(500, 0, 0, 0);
      this.cameras.main.once(
        Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE,
        () => {
          scene.scene.start("Matchups", {
            roomKey,
            socket,
            rounds,
            currentRound: rounds.length - 1,
            currentBattle: 0,
          });
        }
      );
    });

    EventBus.emit("current-scene-ready", this);

    const { roomKey, currentRound, currentBattle } = scene;

    this.socket?.emit("sendReady", { roomKey, currentRound, currentBattle });
  }

  update() {
    if (!this.player1Moving && !this.player1KO) {
      this.player1Sprite?.anims.play(`${this.battle?.player1.id}-idle`, true);
    }

    if (!this.player2Moving && !this.player2KO) {
      this.player2Sprite?.anims.play(
        `${this.battle?.player2?.id ?? "cpu"}-idle`,
        true
      );
    }

    if (this.player1Health && this.battle) {
      const h1 = Math.round((100 - this.battle.player1.health) * (320 / 100));
      this.player1Health.setX(320 - h1);
      this.player1Health.width = h1;
    }

    if (this.player2Health && this.battle) {
      const h2 = Math.round(
        (100 -
          (this.battle.player2
            ? this.battle.player2.health
            : this.battle.cpuHealth)) *
          (320 / 100)
      );
      this.player2Health.setX(1024 - 320 + h2);
      this.player2Health.width = h2;
      this.player2Health.setOrigin(1, 0);
    }
  }

  handleReady = () => {
    this.winnerText?.setText("");
    this.readyTitle?.setVisible(true);
    this.readyTween?.seek(0);
    this.fightTween?.seek(0);
    this.readyTween?.play();
    this.fxReadyFight?.play();
    this.p1HealthBar?.setVisible(true);
    this.p2HealthBar?.setVisible(true);
    this.player1Text?.setText(this.battle?.player1?.name ?? "Player 1");
    this.player2Text?.setText(this.battle?.player2?.name ?? "CPU");
    this.player1Sprite?.setVisible(true);
    this.player2Sprite?.setVisible(true);
    this.timerText?.setText(`${this.timerCount}`).setVisible(true);

    setTimeout(this.showPlayerInput, 3000);
  };

  handleNext = (args: GameUpdate) => {
    const { battle, rounds, currentRound, currentBattle } = args;

    this.rounds = rounds;
    this.currentRound = currentRound;
    this.currentBattle = currentBattle;
    this.battle = battle;
    this.timerCount = battle.time;

    this.cameras.main.fadeOut(300, 0, 0, 0);
    this.cameras.main.once(
      Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE,
      () => {
        this.winnerText?.setText("");
        this.readyTitle?.setVisible(true);
        this.readyTween?.seek(0);
        this.fightTween?.seek(0);
        this.readyTween?.play();
        this.fxReadyFight?.play();
        this.p1HealthBar?.setVisible(true);
        this.p2HealthBar?.setVisible(true);
        this.player1Text?.setText(battle?.player1?.name ?? "Player 1");
        this.player2Text?.setText(battle?.player2?.name ?? "CPU");
        this.player1Sprite?.setVisible(true);
        this.player2Sprite?.setVisible(true);
        this.timerText?.setText(`${this.timerCount}`).setVisible(true);
        this.showPlayerInput();
        this.cameras.main.fadeIn(300, 0, 0, 0);
      }
    );

    if (battle?.player1) {
      createPlayerTexture(this, battle?.player1);
      this.player1Sprite?.setTexture(battle.player1.id);
      if (!this.anims.exists(`${battle?.player1.id}-idle`)) {
        this.anims.create({
          key: `${battle?.player1.id}-idle`,
          frames: this.anims.generateFrameNumbers(battle.player1.id, {
            start: 0,
            end: 3,
          }),
          frameRate: 7,
          repeat: -1,
        });
      }
    }
    createPlayerTexture(this, battle?.player2);
    this.player2Sprite?.setTexture(battle.player2?.id ?? "cpu");
    if (!this.anims.exists(`${battle?.player2?.id ?? "cpu"}-idle`)) {
      this.anims.create({
        key: `${battle?.player2?.id ?? "cpu"}-idle`,
        frames: this.anims.generateFrameNumbers(battle.player2?.id ?? "cpu", {
          start: 0,
          end: 3,
        }),
        frameRate: 7,
        repeat: -1,
      });
    }

    this.player1Moving = false;
    this.player2Moving = false;
    const healthP1 = battle.player1.health;
    const healthP2 = battle.player2?.health ?? battle.cpuHealth ?? 0;
    this.player1KO = healthP1 <= 0;
    this.player2KO = healthP2 <= 0;

    this.waiting = false;
    this.movesSent = false;
    this.attackPicked = BattleAttack.None;

    if (this.player1KO || this.player2KO) {
      if (this.player1KO) {
        this.player1Sprite?.anims.stop();
        this.player1Sprite?.setFrame(PlayerFrame.KO);
      }
      if (this.player2KO) {
        this.player2Sprite?.anims.stop();
        this.player2Sprite?.setFrame(PlayerFrame.KO);
      }
    }
  };

  handleTimeUpdate = (args: { time: number }) => {
    this.timerCount = args.time;
    if (this.battle) {
      this.battle.time = args.time;
    }
    this.timerText?.setText(`${args.time}`);
  };

  handleInput = (attack: BattleAttack, defend: BattleDefend) => {
    if (this.attackPicked !== BattleAttack.None) {
      this.movesSent = true;
      const { roomKey } = this;
      this.socket?.emit("sendMoves", {
        roomKey,
        attack: this.attackPicked,
        defend,
      });
      if (this.battle?.player1?.id === this.socket?.id) {
        this.p1ThoughtBubble?.setVisible(false);
      }
      if (this.battle?.player2?.id === this.socket?.id) {
        this.p2ThoughtBubble?.setVisible(false);
      }
    } else {
      this.attackPicked = attack;
      if (this.battle?.player1?.id === this.socket?.id) {
        this.p1ThoughtAttack?.setVisible(false);
        this.p1ThoughtDefend?.setVisible(true);
      }
      if (this.battle?.player2?.id === this.socket?.id) {
        this.p2ThoughtAttack?.setVisible(false);
        this.p2ThoughtDefend?.setVisible(true);
      }
    }
  };

  handleMove = (args: { hidePlayer1?: boolean; hidePlayer2?: boolean }) => {
    const { hidePlayer1, hidePlayer2 } = args;
    console.log(
      `handleMove - hidePlayer1: ${hidePlayer1} hidePlayer2: ${hidePlayer2}`
    );
    if (hidePlayer1 !== undefined) {
      this.p1ThoughtBubble?.setVisible(!hidePlayer1);
      if (this.battle?.player1?.id === this.socket?.id) {
        this.p1ThoughtEllipsis?.setVisible(false);
        this.p1ThoughtText?.setVisible(!hidePlayer1);
        this.p1ThoughtAttack?.setVisible(
          !hidePlayer1 && this.attackPicked === BattleAttack.None
        );
        this.p1ThoughtDefend?.setVisible(
          !hidePlayer1 && this.attackPicked !== BattleAttack.None
        );
        this.p1MoveHigh?.setVisible(!hidePlayer1);
        this.p1MoveMid?.setVisible(!hidePlayer1);
        this.p1MoveLow?.setVisible(!hidePlayer1);
      } else {
        this.p1ThoughtEllipsis?.setVisible(!hidePlayer1);
        this.p1ThoughtText?.setVisible(false);
        this.p1ThoughtAttack?.setVisible(false);
        this.p1ThoughtDefend?.setVisible(false);
        this.p1MoveHigh?.setVisible(false);
        this.p1MoveMid?.setVisible(false);
        this.p1MoveLow?.setVisible(false);
      }
    }
    if (hidePlayer2 !== undefined) {
      this.p2ThoughtBubble?.setVisible(!hidePlayer2);
      if (this.battle?.player2?.id === this.socket?.id) {
        this.p2ThoughtEllipsis?.setVisible(false);
        this.p2ThoughtText?.setVisible(!hidePlayer2);
        this.p2ThoughtAttack?.setVisible(
          !hidePlayer2 && this.attackPicked === BattleAttack.None
        );
        this.p2ThoughtDefend?.setVisible(
          !hidePlayer2 && this.attackPicked !== BattleAttack.None
        );
        this.p2MoveHigh?.setVisible(!hidePlayer2);
        this.p2MoveMid?.setVisible(!hidePlayer2);
        this.p2MoveLow?.setVisible(!hidePlayer2);
      } else {
        this.p2ThoughtEllipsis?.setVisible(!hidePlayer2);
        this.p2ThoughtText?.setVisible(false);
        this.p2ThoughtAttack?.setVisible(false);
        this.p2ThoughtDefend?.setVisible(false);
        this.p2MoveHigh?.setVisible(false);
        this.p2MoveMid?.setVisible(false);
        this.p2MoveLow?.setVisible(false);
      }
    }
  };

  handleBattle = (args: {
    sequence: BattleSequence;
    battle: Battle;
    hidePlayer1?: boolean;
    hidePlayer2?: boolean;
  }) => {
    const { battle, sequence, hidePlayer1, hidePlayer2 } = args;

    if (!this.player2KO && !this.player1KO && sequence) {
      const healthP1 = battle.player1.health;
      const healthP2 = battle.player2?.health ?? battle.cpuHealth ?? 0;
      this.animateSequence(sequence, healthP1, healthP2);

      this.movesSent = false;
      this.attackPicked = BattleAttack.None;
    }

    if (battle.time <= 0) {
      this.winnerText?.setText("Time's up!");
      this.readyButton?.setVisible(true);
    }

    this.handleMove({ hidePlayer1, hidePlayer2 });
    this.battle = battle;
  };

  handleGameUpdate = async (args: GameUpdate) => {
    // no animation or anything in here. this is just a state update if the browser was inactive and
    // missed other messages
    const { battle, rounds, currentRound, currentBattle, waiting } = args;
    if (waiting !== undefined) {
      this.waiting = waiting;
    }

    if (battle.ready && !this.ready) {
      if (this.waiting) {
        this.readyButton?.setVisible(false);
        this.winnerText?.setText("Waiting...");
        //this.fxFightSong?.pause();
        this.p1HealthBar?.setVisible(false);
        this.p2HealthBar?.setVisible(false);
        this.player1Text?.setText("");
        this.player2Text?.setText("");
        this.player1Sprite?.setVisible(false);
        this.player2Sprite?.setVisible(false);
        this.timerText?.setVisible(false);
      } else {
        // missed the ready state
        this.ready = true;
        this.winnerText?.setText("");
        //this.fxFightSong?.play();
        this.p1HealthBar?.setVisible(true);
        this.p2HealthBar?.setVisible(true);
        this.player1Text?.setText(battle.player1.name ?? "Player 1");
        this.player2Text?.setText(battle.player2?.name ?? "CPU");
        this.player1Sprite?.setVisible(true);
        this.player2Sprite?.setVisible(true);
        if (battle?.player1) {
          createPlayerTexture(this, battle?.player1);
          this.player1Sprite?.setTexture(battle.player1.id);
          if (!this.anims.exists(`${battle?.player1.id}-idle`)) {
            this.anims.create({
              key: `${battle?.player1.id}-idle`,
              frames: this.anims.generateFrameNumbers(battle.player1.id, {
                start: 0,
                end: 3,
              }),
              frameRate: 7,
              repeat: -1,
            });
          }
        }
        createPlayerTexture(this, battle?.player2);
        this.player1Sprite?.setTexture(battle.player2?.id ?? "cpu");
        if (!this.anims.exists(`${battle?.player2?.id ?? "cpu"}-idle`)) {
          this.anims.create({
            key: `${battle?.player2?.id ?? "cpu"}-idle`,
            frames: this.anims.generateFrameNumbers(
              battle.player2?.id ?? "cpu",
              {
                start: 0,
                end: 3,
              }
            ),
            frameRate: 7,
            repeat: -1,
          });
        }
        this.timerText?.setText(`${battle.time}`).setVisible(true);
      }
    }

    // if there's a difference in moves sent value, missed receiving a battle updated
    const movesSent = this.movesSent;
    this.movesSent = await this.haveMovesBeenSent();
    if (!this.movesSent && movesSent) {
      this.attackPicked = BattleAttack.None;
    }

    this.player1Moving = false;
    this.player2Moving = false;
    const healthP1 = battle.player1.health;
    const healthP2 = battle.player2?.health ?? battle.cpuHealth ?? 0;
    this.player1KO = healthP1 <= 0;
    this.player2KO = healthP2 <= 0;

    if (
      this.battle?.player1.id !== battle.player1.id ||
      this.battle?.player2?.id !== battle.player2?.id
    ) {
      this.waiting = false;
    }

    this.rounds = rounds;
    this.currentRound = currentRound;
    this.currentBattle = currentBattle;
    this.battle = battle;
    this.timerCount = battle.time;

    if (this.player1KO || this.player2KO) {
      if (this.player1KO) {
        this.player1Sprite?.anims.stop();
        this.player1Sprite?.setFrame(PlayerFrame.KO);
      }
      if (this.player2KO) {
        this.player2Sprite?.anims.stop();
        this.player2Sprite?.setFrame(PlayerFrame.KO);
      }
      if (!this.waiting) {
        this.readyButton?.setVisible(true);
        const winner = this.player1KO
          ? this.battle?.player2?.name ?? "CPU"
          : this.battle?.player1.name;
        this.winnerText?.setText(`${winner} wins!`);
      }
    }
    if (this.timerCount <= 0) {
      if (!this.waiting) {
        this.readyButton?.setVisible(true);
        this.winnerText?.setText("Time's up!");
      }
    }
    this.showPlayerInput();
  };

  showPlayerInput = async () => {
    const { showP1, showP2, showInputsP1, showInputsP2 } =
      await this.getInputStatus();

    if (showP1) {
      this.p1ThoughtBubble?.setVisible(true);
      if (showInputsP1) {
        this.p1ThoughtEllipsis?.setVisible(false);
        this.p1ThoughtText?.setVisible(true);
        if (this.attackPicked !== BattleAttack.None) {
          this.p1ThoughtAttack?.setVisible(false);
          this.p1ThoughtDefend?.setVisible(true);
        } else {
          this.p1ThoughtDefend?.setVisible(false);
          this.p1ThoughtAttack?.setVisible(true);
        }
        this.p1MoveHigh?.setVisible(true);
        this.p1MoveMid?.setVisible(true);
        this.p1MoveLow?.setVisible(true);
      } else {
        this.p1ThoughtEllipsis?.setVisible(true);
        this.p1ThoughtText?.setVisible(false);
        this.p1ThoughtAttack?.setVisible(false);
        this.p1ThoughtDefend?.setVisible(false);
        this.p1MoveHigh?.setVisible(false);
        this.p1MoveMid?.setVisible(false);
        this.p1MoveLow?.setVisible(false);
      }
    } else {
      this.p1ThoughtBubble?.setVisible(false);
    }

    if (showP2) {
      this.p2ThoughtBubble?.setVisible(true);
      if (showInputsP2) {
        this.p2ThoughtEllipsis?.setVisible(false);
        this.p2ThoughtText?.setVisible(true);
        if (this.attackPicked !== BattleAttack.None) {
          this.p2ThoughtAttack?.setVisible(false);
          this.p2ThoughtDefend?.setVisible(true);
        } else {
          this.p2ThoughtDefend?.setVisible(false);
          this.p2ThoughtAttack?.setVisible(true);
        }
        this.p2MoveHigh?.setVisible(true);
        this.p2MoveMid?.setVisible(true);
        this.p2MoveLow?.setVisible(true);
      } else {
        this.p2ThoughtEllipsis?.setVisible(true);
        this.p2ThoughtText?.setVisible(false);
        this.p2ThoughtAttack?.setVisible(false);
        this.p2ThoughtDefend?.setVisible(false);
        this.p2MoveHigh?.setVisible(false);
        this.p2MoveMid?.setVisible(false);
        this.p2MoveLow?.setVisible(false);
      }
    } else {
      this.p2ThoughtBubble?.setVisible(false);
    }
  };

  animateSequence = (
    sequence: BattleSequence,
    healthP1: number,
    healthP2: number
  ) => {
    const player1Attacking = sequence.playerId === this.battle?.player1.id;
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

    if (!this.player2Moving) {
      this.player2Moving = true;
      this.player2Sprite?.anims.stop();
      if (player1Attacking) {
        this.setPlayer2Health(healthP2);
        if (healthP2 > 0) {
          if (isBlock) {
            switch (sequence.opponentResponse) {
              case BattleDefend.High:
                this.player2Sprite?.setFrame(PlayerFrame.HighBlock);
                break;
              case BattleDefend.Mid:
                this.player2Sprite?.setFrame(PlayerFrame.MidBlock);
                break;
              case BattleDefend.Low:
                this.player2Sprite?.setFrame(PlayerFrame.LowMiss);
                break;
            }
          } else {
            switch (sequence.attack) {
              case BattleAttack.High:
                this.player2Sprite?.setFrame(PlayerFrame.HighHit);
                break;
              case BattleAttack.Mid:
                this.player2Sprite?.setFrame(PlayerFrame.MidHit);
                break;
              case BattleAttack.Low:
                this.player2Sprite?.setFrame(PlayerFrame.MidHit);
                break;
            }
          }
        } else {
          this.player2KO = true;
          this.player2Sprite?.setFrame(PlayerFrame.KO);
        }
        if (isBlock) {
          const scene = this;
          setTimeout(() => {
            scene.player2Moving = false;
          }, 400);
        } else {
          const scene = this;
          const { x, y } = this.player2Sprite ?? { x: 0 };
          const move2Tween = this.tweens.add({
            targets: this.player2Sprite,
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
      } else {
        switch (sequence.attack) {
          case BattleAttack.High:
            this.player2Sprite?.setFrame(PlayerFrame.HighKick);
            break;
          case BattleAttack.Mid:
            this.player2Sprite?.setFrame(PlayerFrame.MidKick);
            break;
          case BattleAttack.Low:
            this.player2Sprite?.setFrame(PlayerFrame.LowPunch);
            break;
        }
        const scene = this;
        setTimeout(() => {
          scene.player2Moving = false;
        }, 400);
      }
    }

    this.sound.play(fxid, { loop: false, volume: 0.3 });

    if (!this.player1Moving) {
      this.player1Moving = true;
      this.player1Sprite?.anims.stop();
      if (!player1Attacking) {
        this.setPlayer1Health(healthP1);
        if (healthP1 > 0) {
          if (isBlock) {
            switch (sequence.opponentResponse) {
              case BattleDefend.High:
                this.player1Sprite?.setFrame(PlayerFrame.HighBlock);
                break;
              case BattleDefend.Mid:
                this.player1Sprite?.setFrame(PlayerFrame.MidBlock);
                break;
              case BattleDefend.Low:
                this.player1Sprite?.setFrame(PlayerFrame.LowMiss);
                break;
            }
          } else {
            switch (sequence.attack) {
              case BattleAttack.High:
                this.player1Sprite?.setFrame(PlayerFrame.HighHit);
                break;
              case BattleAttack.Mid:
                this.player1Sprite?.setFrame(PlayerFrame.MidHit);
                break;
              case BattleAttack.Low:
                this.player1Sprite?.setFrame(PlayerFrame.MidHit);
                break;
            }
          }
        } else {
          this.player1KO = true;
          this.player1Sprite?.setFrame(PlayerFrame.KO);
        }
        if (isBlock) {
          const scene = this;
          setTimeout(() => {
            scene.player1Moving = false;
          }, 400);
        } else {
          const scene = this;
          const { x, y } = this.player1Sprite ?? { x: 0 };
          const move1Tween = this.tweens.add({
            targets: this.player1Sprite,
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
      } else {
        switch (sequence.attack) {
          case BattleAttack.High:
            this.player1Sprite?.setFrame(PlayerFrame.HighKick);
            break;
          case BattleAttack.Mid:
            this.player1Sprite?.setFrame(PlayerFrame.MidKick);
            break;
          case BattleAttack.Low:
            this.player1Sprite?.setFrame(PlayerFrame.LowPunch);
            break;
        }
        const scene = this;
        setTimeout(() => {
          scene.player1Moving = false;
        }, 400);
      }
    }

    if (this.player2KO || this.player1KO) {
      this.sound.play("ko", { loop: false, volume: 0.3 });

      const winner = this.player1KO
        ? this.battle?.player2?.name ?? "CPU"
        : this.battle?.player1.name;
      this.winnerText?.setText(`${winner} wins!`);
      this.readyButton?.setVisible(true);
    }
  };

  setPlayer1Health = (health: number) => {
    if (this.battle?.player1) {
      this.battle.player1.health = health;
    }
  };

  setPlayer2Health = (health: number) => {
    if (this.battle?.player2) {
      this.battle.player1.health = health;
    }
  };

  haveMovesBeenSent = (): Promise<boolean> => {
    const { socket, roomKey } = this;
    return new Promise(function (resolve, reject) {
      socket?.emit("checkMovesSent", { roomKey }, (answer: boolean) => {
        resolve(answer);
      });
    });
  };

  getInputStatus = (): Promise<{
    showP1: boolean;
    showP2: boolean;
    showInputsP1: boolean;
    showInputsP2: boolean;
  }> => {
    const { socket, roomKey } = this;
    return new Promise(function (resolve, reject) {
      socket?.emit(
        "checkInputStatus",
        { roomKey },
        (result: {
          showP1: boolean;
          showP2: boolean;
          showInputsP1: boolean;
          showInputsP2: boolean;
        }) => {
          resolve(result);
        }
      );
    });
  };
}
