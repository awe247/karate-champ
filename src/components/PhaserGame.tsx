import React, {
  forwardRef,
  useRef,
  useEffect,
  useLayoutEffect,
  useContext,
} from "react";
import { Socket } from "socket.io-client";
import { AUTO, Game, Scene, Events } from "phaser";
import { Main } from "../scenes/Main";
import { Matchups } from "../scenes/Matchups";
import { Fight } from "../scenes/Fight";
import { SocketContext } from "../socket";

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
  backgroundColor: "#000000",
  dom: {
    createContainer: true,
  },
  scene: [],
};

class KarateChamp extends Game {
  constructor(socket: Socket | undefined) {
    // Add the config file to the game
    super(config);

    // Add all the scenes
    this.scene.add("Main", Main);
    this.scene.add("Matchups", Matchups);
    this.scene.add("Fight", Fight);

    // Start the game with the mainscene
    this.scene.start("Main", { socket });
  }
}

export const EventBus = new Events.EventEmitter();

export interface IRefPhaserGame {
  game: Game | null;
  scene: Scene | null;
}

interface IProps {
  currentActiveScene?: (scene_instance: Scene) => void;
}

export const PhaserGame = forwardRef<IRefPhaserGame, IProps>(
  function PhaserGame({ currentActiveScene }, ref) {
    const game = useRef<Game | null>(null!);
    const { socket } = useContext(SocketContext) ?? {};

    useLayoutEffect(() => {
      if (game.current === null) {
        game.current = new KarateChamp(socket);

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

    useEffect(() => {
      EventBus.on("current-scene-ready", (scene_instance: Scene) => {
        if (currentActiveScene && typeof currentActiveScene === "function") {
          currentActiveScene(scene_instance);
        }

        if (typeof ref === "function") {
          ref({ game: game.current, scene: scene_instance });
        } else if (ref) {
          ref.current = { game: game.current, scene: scene_instance };
        }
      });

      return () => {
        EventBus.removeListener("current-scene-ready");
      };
    }, [currentActiveScene, ref]);

    return <div id="mygame"></div>;
  }
);
