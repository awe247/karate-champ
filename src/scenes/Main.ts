import { Scene } from "phaser";

export class Main extends Scene {
  constructor() {
    super("Main");
  }

  preload() {
    this.load.image("background", "assets/bg.png");
  }

  create() {
    const scene = this;

    scene.add.image(0, 0, "background").setOrigin(0);
  }
}
