import { Scene } from "phaser";
import { Socket } from "socket.io-client";
import { EventBus, Battle, PlayerBattle } from "../components/PhaserGame";

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
        key: "idle",
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
      key: "idle",
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
    this.player1Sprite?.anims.play("idle", true);
    this.player2Sprite?.anims.play("idle", true);
  }
}

function hexToColor(hex: string): number[] {
  // Remove '#' if present
  hex = hex.replace("#", "");

  // Parse the hexadecimal color components
  let r = parseInt(hex.substring(0, 2), 16);
  let g = parseInt(hex.substring(2, 4), 16);
  let b = parseInt(hex.substring(4, 6), 16);

  return [r, g, b];
}

function createPlayerTexture(scene: Phaser.Scene, player?: PlayerBattle) {
  // CPU colors;
  let { hairColor, eyeColor, skinColor, giColor } = player ?? {
    hairColor: "#464d56",
    eyeColor: "#ff0000",
    skinColor: "#81c2e4",
    giColor: "#1b4478",
  };

  const h = hexToColor(hairColor);
  const e = hexToColor(eyeColor);
  const s = hexToColor(skinColor);
  const g = hexToColor(giColor);

  // Create a canvas and get its 2D context
  let canvas = document.createElement("canvas");
  let ctx = canvas.getContext("2d");
  if (!ctx) {
    return;
  }

  let texture = scene.textures.get("player").getSourceImage();
  canvas.width = texture.width;
  canvas.height = texture.height;

  ctx.drawImage(texture as CanvasImageSource, 0, 0);

  // Get the pixel data of the canvas
  let imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  let data = imageData.data;

  // Iterate over each pixel
  for (let i = 0; i < data.length; i += 4) {
    // Ignore any transparency
    if (data[i + 3] !== 255) continue;

    // Check if the pixel color matches the color to replace
    if (data[i] === 255) {
      // gi, skin or eye
      if (data[i + 1] === 0 && data[i + 2] === 0) {
        // eye
        data[i] = e[0];
        data[i + 1] = e[1];
        data[i + 2] = e[2];
      } else if (data[i + 1] === 0 && data[i + 2] === 255) {
        // gi
        data[i] = g[0];
        data[i + 1] = g[1];
        data[i + 2] = g[2];
      } else if (data[i + 1] === 255 && data[i + 2] === 0) {
        // skin
        data[i] = s[0];
        data[i + 1] = s[1];
        data[i + 2] = s[2];
      }
    } else if (data[i] === 0) {
      if (data[i + 1] === 255 && data[i + 2] === 255) {
        // hair
        data[i] = h[0];
        data[i + 1] = h[1];
        data[i + 2] = h[2];
      } else if (data[i + 1] === 0 && data[i + 2] === 0 && !player) {
        // outline
        data[i] = 255;
        data[i + 1] = 555;
        data[i + 2] = 255;
      }
    }
  }

  // Draw the modified pixel data back onto the canvas
  ctx.putImageData(imageData, 0, 0);

  // Create a new texture from the modified canvas
  const canvasTexture = scene.textures
    .addCanvas(`${player?.id ?? "cpu"}-texture`, canvas)
    ?.getSourceImage();

  if (canvasTexture) {
    scene.textures.addSpriteSheet(
      player?.id ?? "cpu",
      canvasTexture as HTMLImageElement,
      { frameWidth: 56, frameHeight: 56 }
    );
  }
}
