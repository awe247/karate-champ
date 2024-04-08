import React, { forwardRef, useRef, useLayoutEffect } from "react";
import { AUTO, Game } from "phaser";
import { Main } from "../scenes/Main";

const config: Phaser.Types.Core.GameConfig = {
  type: AUTO,
  width: 1024,
  height: 768,
  render: {
    pixelArt: true,
  },
  parent: "mygame",
  scale: {
    parent: "mygame",
    autoCenter: Phaser.Scale.Center.CENTER_HORIZONTALLY,
  },
  backgroundColor: "#028af8",
  dom: {
    createContainer: true,
  },
  scene: [],
};

class StartGame extends Game {
  constructor() {
    // Add the config file to the game
    super(config);

    // Add all the scenes
    this.scene.add("Main", Main);
    // this.scene.add("WaitingRoom", WaitingRoom);
    // this.scene.add("TaskScene", TaskScene);

    // Start the game with the mainscene
    this.scene.start("Main");
  }
}

export interface IRefPhaserGame {
  game: Phaser.Game | null;
  scene: Phaser.Scene | null;
}

interface IProps {
  currentActiveScene?: (scene_instance: Phaser.Scene) => void;
}

export const PhaserGame = forwardRef<IRefPhaserGame, IProps>(
  function PhaserGame({ currentActiveScene }, ref) {
    const game = useRef<Phaser.Game | null>(null!);

    useLayoutEffect(() => {
      if (game.current === null) {
        game.current = new StartGame();

        if (typeof ref === "function") {
          ref({ game: game.current, scene: null });
        } else if (ref) {
          ref.current = { game: game.current, scene: null };
        }
      }

      return () => {
        if (game.current) {
          game.current.destroy(true);
          if (game.current !== null) {
            game.current = null;
          }
        }
      };
    }, [ref]);

    return <div id="mygame"></div>;
  }
);
