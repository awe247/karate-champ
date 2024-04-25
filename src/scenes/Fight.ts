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
      } else {
        this.socket?.off("ready");
        this.socket?.off("moveUpdate");
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
    const scene = this;

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
      repeat: 0,
      paused: true,
    });
    this.fightTween = scene.tweens.add({
      targets: scene.fightTitle,
      scale: { value: 3.0, duration: 700, ease: "Back.easeInOut" },
      yoyo: true,
      repeat: 0,
      paused: true,
    });

    this.readyTween.on("start", () => {
      scene.fxReadyFight?.play();
      scene.readyTitle?.setVisible(true);
    });
    this.readyTween.on("complete", () => {
      scene.readyTitle?.setVisible(false);
      scene.fightTitle?.setVisible(true);
      scene.fightTween?.restart();
    });
    this.fightTween.on("complete", () => {
      scene.fightTitle?.setVisible(false);
      scene.fxFightSong?.play();
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

    // this.socket?.on("battleComplete", async (args: { battle: Battle }) => {
    //   scene.timerCount = 0;
    //   scene.winnerText?.setText(`Time's up!`);
    // });

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

    this.socket?.on("timeUpdate", (args: { time: number }) => {
      scene.timerCount = args.time;
      if (scene.battle) {
        scene.battle.time = args.time;
      }
      scene.timerText?.setText(`${args.time}`);
    });

    this.socket?.on("moveUpdate", this.handleMove);

    this.socket?.on("battleUpdate", this.handleBattle);

    this.socket?.on("gameUpdate", (args: GameUpdate) => {
      // no animation or anything in here. this is just a state update if the browser was inactive and
      // missed other messages
      const { battle, rounds, currentRound, currentBattle } = args;

      if (battle.ready && !this.ready) {
        // missed the ready state
        this.ready = true;
        scene.winnerText?.setText("");
        scene.fxFightSong?.play();
        scene.p1HealthBar?.setVisible(true);
        scene.p2HealthBar?.setVisible(true);
        scene.player1Text?.setText(battle.player1.name ?? "Player 1");
        scene.player2Text?.setText(battle.player2?.name ?? "CPU");
        scene.player1Sprite?.setVisible(true);
        scene.player2Sprite?.setVisible(true);
        scene.timerText?.setText(`${battle.time}`).setVisible(true);
      }

      scene.rounds = rounds;
      scene.currentRound = currentRound;
      scene.currentBattle = currentBattle;
      scene.battle = battle;
      scene.timerCount = battle.time;

      scene.showPlayerInput();
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
  }

  handleReady = () => {
    const scene = this;
    scene.winnerText?.setText("");
    scene.readyTween?.restart();
    scene.p1HealthBar?.setVisible(true);
    scene.p2HealthBar?.setVisible(true);
    scene.player1Text?.setText(this.battle?.player1?.name ?? "Player 1");
    scene.player2Text?.setText(this.battle?.player2?.name ?? "CPU");
    scene.player1Sprite?.setVisible(true);
    scene.player2Sprite?.setVisible(true);
    scene.timerText?.setText(`${this.timerCount}`).setVisible(true);

    setTimeout(scene.showPlayerInput, 3000);
  };

  handleInput = (attack: BattleAttack, defend: BattleDefend) => {
    const scene = this;
    if (scene.attackPicked !== BattleAttack.None) {
      scene.movesSent = true;
      const { roomKey } = scene;
      scene.socket?.emit("sendMoves", {
        roomKey,
        attack: scene.attackPicked,
        defend,
      });
      if (scene.battle?.player1?.id === scene.socket?.id) {
        scene.p1ThoughtBubble?.setVisible(false);
      }
      if (scene.battle?.player2?.id === scene.socket?.id) {
        scene.p2ThoughtBubble?.setVisible(false);
      }
    } else {
      scene.attackPicked = attack;
      if (scene.battle?.player1?.id === scene.socket?.id) {
        scene.p1ThoughtAttack?.setVisible(false);
        scene.p1ThoughtDefend?.setVisible(true);
      }
      if (scene.battle?.player2?.id === scene.socket?.id) {
        scene.p2ThoughtAttack?.setVisible(false);
        scene.p2ThoughtDefend?.setVisible(true);
      }
    }
  };

  handleMove = (args: {
    player1NeedInput: boolean;
    player2NeedInput?: boolean;
  }) => {
    const scene = this;
    if (scene.battle) {
      scene.battle.player1NeedInput = args.player1NeedInput;
      scene.battle.player2NeedInput = args.player2NeedInput;
      scene.showPlayerInput();
    }
  };

  handleBattle = (args: {
    sequence: BattleSequence;
    battle: Battle;
    reset: boolean;
  }) => {
    const { battle, sequence, reset } = args;
    const scene = this;

    if (!scene.player2KO && !scene.player1KO && sequence) {
      const healthP1 = battle.player1.health;
      const healthP2 = battle.player2?.health ?? battle.cpuHealth ?? 0;
      scene.animateSequence(sequence, healthP1, healthP2);
      if (reset) {
        scene.movesSent = false;
        scene.attackPicked = BattleAttack.None;
        if (scene.battle) {
          scene.battle.player1NeedInput = battle.player1NeedInput;
          scene.battle.player2NeedInput = battle.player2NeedInput;
        }
        scene.showPlayerInput();
      }
    }

    scene.battle = battle;
  };

  showPlayerInput = () => {
    const scene = this;
    const showBubble1 = scene.battle?.player1NeedInput;
    const showBubble2 = scene.battle?.player2NeedInput;
    const showInputs1 =
      scene.battle?.player1?.id === scene.socket?.id && !scene.movesSent;
    const showInputs2 =
      scene.battle?.player2?.id === scene.socket?.id && !scene.movesSent;

    if (showBubble1) {
      scene.p1ThoughtBubble?.setVisible(true);
      if (showInputs1) {
        scene.p1ThoughtEllipsis?.setVisible(false);
        scene.p1ThoughtText?.setVisible(true);
        if (scene.attackPicked !== BattleAttack.None) {
          scene.p1ThoughtAttack?.setVisible(false);
          scene.p1ThoughtDefend?.setVisible(true);
        } else {
          scene.p1ThoughtDefend?.setVisible(false);
          scene.p1ThoughtAttack?.setVisible(true);
        }
        scene.p1MoveHigh?.setVisible(true);
        scene.p1MoveMid?.setVisible(true);
        scene.p1MoveLow?.setVisible(true);
      } else {
        scene.p1ThoughtEllipsis?.setVisible(true);
        scene.p1ThoughtText?.setVisible(false);
        scene.p1ThoughtAttack?.setVisible(false);
        scene.p1ThoughtDefend?.setVisible(false);
        scene.p1MoveHigh?.setVisible(false);
        scene.p1MoveMid?.setVisible(false);
        scene.p1MoveLow?.setVisible(false);
      }
    } else {
      scene.p1ThoughtBubble?.setVisible(false);
    }

    if (showBubble2) {
      scene.p2ThoughtBubble?.setVisible(true);
      if (showInputs2) {
        scene.p2ThoughtEllipsis?.setVisible(false);
        scene.p2ThoughtText?.setVisible(true);
        if (scene.attackPicked !== BattleAttack.None) {
          scene.p2ThoughtAttack?.setVisible(false);
          scene.p2ThoughtDefend?.setVisible(true);
        } else {
          scene.p2ThoughtDefend?.setVisible(false);
          scene.p2ThoughtAttack?.setVisible(true);
        }
        scene.p2MoveHigh?.setVisible(true);
        scene.p2MoveMid?.setVisible(true);
        scene.p2MoveLow?.setVisible(true);
      } else {
        scene.p2ThoughtEllipsis?.setVisible(true);
        scene.p2ThoughtText?.setVisible(false);
        scene.p2ThoughtAttack?.setVisible(false);
        scene.p2ThoughtDefend?.setVisible(false);
        scene.p2MoveHigh?.setVisible(false);
        scene.p2MoveMid?.setVisible(false);
        scene.p2MoveLow?.setVisible(false);
      }
    } else {
      scene.p2ThoughtBubble?.setVisible(false);
    }
  };

  animateSequence = (
    sequence: BattleSequence,
    healthP1: number,
    healthP2: number
  ) => {
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
  };
}
