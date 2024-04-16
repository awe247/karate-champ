const gameRooms = {
  // [roomKey]: {
  //  players: PlayerMap,
  //  numPlayers: 0
  //  started: false,
  //  rounds: Round[]
  // }
};

module.exports = (io) => {
  io.on("connection", (socket) => {
    console.log(
      `A socket connection to the server has been made: ${socket.id}`
    );

    // create and join the room
    socket.on("createGame", async function (args) {
      const { playerName, hairColor, skinColor, eyeColor, giColor } = args;
      let key = codeGenerator();
      while (Object.keys(gameRooms).includes(key)) {
        key = codeGenerator();
      }
      gameRooms[key] = {
        roomKey: key,
        players: {},
        numPlayers: 1,
        started: false,
        rounds: [],
      };
      gameRooms[key].players[socket.id] = {
        id: socket.id,
        name: playerName,
        hairColor,
        skinColor,
        eyeColor,
        giColor,
      };
      const { players } = gameRooms[key];
      socket.join(key);
      socket.emit("roomCreated", { roomKey: key, players });
    });

    // check for the existence of a room
    socket.on("isCodeValid", function (args) {
      const { joinCode } = args;
      if (Object.keys(gameRooms).includes(joinCode)) {
        if (gameRooms[joinCode].numPlayers < 32) {
          if (!gameRooms[joinCode].started) {
            socket.emit("codeIsValid", joinCode);
          } else {
            socket.emit("codeNotValid", "Game in progress.");
          }
        } else {
          socket.emit("codeNotValid", "Room full.");
        }
      } else {
        socket.emit("codeNotValid");
      }
    });

    // join the room
    socket.on("joinRoom", (args) => {
      const { playerName, hairColor, skinColor, eyeColor, giColor, joinCode } =
        args;
      gameRooms[joinCode].players[socket.id] = {
        id: socket.id,
        name: playerName,
        hairColor,
        skinColor,
        eyeColor,
        giColor,
      };
      socket.join(joinCode);

      // update number of players
      const { players } = gameRooms[joinCode];

      gameRooms[joinCode].numPlayers = Object.keys(players).length;

      socket.emit("roomJoined", { roomKey: joinCode, players });

      // update all other players of the new player
      socket.to(joinCode).emit("roomUpdate", { players });
    });

    // start the game
    socket.on("startGame", (args) => {
      const { roomKey } = args;
      gameRooms[roomKey].started = true;
      const { players } = gameRooms[roomKey];
      const round1 = {
        name: "Round 1",
        battles: [],
      };
      const orderedPairs = Object.values(players)
        .sort((a, b) => (a.id < b.id ? -1 : 1))
        .reduce(function (result, value, index, arr) {
          if (index % 2 === 0) {
            result.push(arr.slice(index, index + 2).map((p) => p.id));
          }
          return result;
        }, []);
      orderedPairs.forEach((pair) => {
        const battle = { player1: { id: pair[0], health: 100 }, time: 60 };
        if (pair.length > 1 && pair[1] !== undefined) {
          battle.player2 = { id: pair[1], health: 100 };
        }
        round1.battles.push(battle);
      });
      const currentRound = 0;
      const currentBattle = 0;
      gameRooms[roomKey].rounds.push(round1);
      gameRooms[roomKey].currentRound = currentRound;
      gameRooms[roomKey].currentBattle = currentBattle;

      const battles = round1.battles.map((b) => {
        const p1 = b.player1 ? players[b.player1.id] : undefined;
        const p2 = b.player2 ? players[b.player2.id] : undefined;
        return b.resultText ?? `${p1?.name ?? "CPU"} vs. ${p2?.name ?? "CPU"}`;
      });

      io.in(roomKey).emit("showMatchups", {
        rounds: [{ battles, name: round1.name }],
        currentRound,
        currentBattle,
      });
    });

    // when a player disconnects, remove them from our players object
    socket.on("disconnect", function () {
      // find which room they belong to
      let roomKey = 0;
      for (let keys1 in gameRooms) {
        for (let keys2 in gameRooms[keys1]) {
          Object.keys(gameRooms[keys1][keys2]).map((el) => {
            if (el === socket.id) {
              roomKey = keys1;
            }
          });
        }
      }

      const roomInfo = gameRooms[roomKey];

      if (roomInfo) {
        console.log("user disconnected: ", socket.id);
        // remove this player from our players object
        delete roomInfo.players[socket.id];
        // update numPlayers
        roomInfo.numPlayers = Object.keys(roomInfo.players).length;
        // emit a message to all players to remove this player
        io.to(roomKey).emit("roomUpdate", {
          players: roomInfo.players,
        });
      }
    });
  });
};

function codeGenerator() {
  let code = "";
  let chars = "ABCDEFGHJKLMNPQRSTUVWXYZ0123456789";
  for (let i = 0; i < 5; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// function getTestBattles() {
//   const rounds = [];
//   for (let i = 0; i < 5; i++) {
//     const r = {
//       name: `Round ${i}`,
//       battles: [],
//     };
//     for (let j = 0; j < 30; j++) {
//       r.battles.push(`Player ABC${j} vs. Player DEF${j}`);
//     }
//     rounds.push(r);
//   }
//   return rounds;
// }
