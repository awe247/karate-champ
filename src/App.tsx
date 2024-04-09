import React, { useRef, useState, useContext, useEffect } from "react";
import { SocketContext } from "./socket";
import { PhaserGame, IRefPhaserGame } from "./components/PhaserGame";
import { PlayerDisplay } from "./components/PlayerDisplay";

export const App: React.FC = () => {
  const { socket } = useContext(SocketContext) ?? {};
  const [joinedGame, setJoinedGame] = useState(false);
  const [playerName, setPlayerName] = useState(
    `Player${(Math.floor(Math.random() * 10000) + 10000)
      .toString()
      .substring(1)}`
  );
  const [joinCode, setJoinCode] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  // References to the PhaserGame component (game and scene are exposed)
  const phaserRef = useRef<IRefPhaserGame | null>(null);

  useEffect(() => {
    socket?.on("roomCreated", function (roomKey: string) {
      setJoinedGame(true);
    });

    socket?.on("codeNotValid", function () {
      setErrorMessage("Not a valid code.");
    });

    socket?.on("codeIsValid", function (joinCode: string) {
      setErrorMessage("");
      socket.emit("joinRoom", { playerName, joinCode });
    });

    socket?.on("roomJoined", function () {
      setJoinedGame(true);
    });
  }, [socket]);

  // Event emitted from the PhaserGame component
  const currentScene = (scene: Phaser.Scene) => {
    console.log(`scene - ${scene}`);
  };

  const handleCreateGame = () => {
    setErrorMessage("");
    socket?.emit("createGame", { playerName });
  };

  const handleJoinGame = () => {
    setErrorMessage("");
    socket?.emit("isCodeValid", { joinCode });
  };

  return (
    <div id="app">
      <PhaserGame ref={phaserRef} currentActiveScene={currentScene} />
      {!joinedGame && (
        <div className="popup">
          <div className="flex flex-col space-y-2">
            <h3 className="font-bold">Player</h3>
            <label className="text-xs" htmlFor="player-name">
              Name
            </label>
            <input
              className="txt"
              type="text"
              id="player-name"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
            />
            <div className="flex flex-row">
              <div className="w-1/2">
                <PlayerDisplay
                  hairColor="#efd738"
                  skinColor="#ffeedb"
                  eyeColor="#00ff00"
                  giColor="#ff0000"
                />
              </div>
              <div className="flex flex-col mx-auto">
                <label className="text-xs block" htmlFor="hair-color">
                  Hair
                </label>
                <input
                  className="clr"
                  type="color"
                  id="hair-color"
                  value="#efd738"
                ></input>
                <label className="text-xs block" htmlFor="skin-color">
                  Skin
                </label>
                <input
                  className="clr"
                  type="color"
                  id="skin-color"
                  value="#ffeedb"
                ></input>
                <label className="text-xs block" htmlFor="eye-color">
                  Eyes
                </label>
                <input
                  className="clr"
                  type="color"
                  id="eye-color"
                  value="#0000ff"
                ></input>
                <label className="text-xs block" htmlFor="gi-color">
                  Gi
                </label>
                <input
                  className="clr"
                  type="color"
                  id="gi-color"
                  value="#ffffff"
                ></input>
              </div>
            </div>
            <h3 className="font-bold">Tournament</h3>
            <div className="btn" onClick={handleCreateGame}>
              Create
            </div>
            <div className="flex flex-row space-x-2">
              <div className="w-full">
                <label className="text-xs" htmlFor="join-code">
                  Code
                </label>
                <input
                  className="txt"
                  type="text"
                  id="join-code"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value)}
                />
              </div>
              <div className="content-end">
                <div className="btn" onClick={handleJoinGame}>
                  Join
                </div>
              </div>
            </div>
            <div className="text-red-600 text-xs">{errorMessage}</div>
          </div>
        </div>
      )}
    </div>
  );
};
