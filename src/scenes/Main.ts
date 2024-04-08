import { Scene } from "phaser";

export class Main extends Scene {
  background: Phaser.GameObjects.Image | undefined;
  title: Phaser.GameObjects.Image | undefined;
  titleTween: Phaser.Tweens.Tween | undefined;

  constructor() {
    super("Main");
  }

  preload() {
    this.load.image("background", "assets/bg.png");
    this.load.image("title", "assets/title.png");
  }

  create() {
    const scene = this;

    scene.background = scene.add.image(0, 0, "background").setOrigin(0);
    scene.title = scene.add.image(512, 384, "title").setOrigin(0.5, 0.5);

    scene.titleTween = scene.tweens.add({
      targets: scene.title,
      scale: { value: 1.3, duration: 700, ease: "Back.easeInOut" },
      yoyo: true,
      repeat: -1,
    });
  }
}
