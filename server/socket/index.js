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
      const currentRound = 0;
      const currentBattle = 0;
      gameRooms[roomKey].rounds = createRounds(players);
      gameRooms[roomKey].currentRound = currentRound;
      gameRooms[roomKey].currentBattle = currentBattle;
      const rounds = getMatchupDescriptions(gameRooms[roomKey]);
      const battle =
        gameRooms[roomKey].rounds[currentRound].battles[currentBattle];

      io.in(roomKey).emit("gameUpdate", {
        battle,
        rounds,
        currentRound,
        currentBattle,
      });
    });

    // client has requested the latest game state
    socket.on("needUpdate", (args) => {
      const { roomKey } = args;
      if (gameRooms[roomKey]?.started) {
        const { currentRound, currentBattle } = gameRooms[roomKey];
        const rounds = getMatchupDescriptions(gameRooms[roomKey]);
        const battle =
          gameRooms[roomKey].rounds[currentRound].battles[currentBattle];

        socket.emit("gameUpdate", {
          rounds,
          currentRound,
          currentBattle,
          battle,
        });
      }
    });

    socket.on("sendReady", (args) => {
      const { roomKey, currentRound, currentBattle } = args;
      if (
        gameRooms[roomKey].started &&
        gameRooms[roomKey].currentRound === currentRound &&
        gameRooms[roomKey].currentBattle === currentBattle
      ) {
        const battle =
          gameRooms[roomKey].rounds[currentRound].battles[currentBattle];

        // want at least one of the players in the battle
        if (
          !battle.ready &&
          (battle.player1?.id === socket.id || battle.player2?.id === socket.id)
        ) {
          battle.ready = true;
          setTimeout(() => {
            io.in(roomKey).emit("ready");
            gameRooms[roomKey].timer = setInterval(() => {
              if (battle.time > 0) {
                battle.time--;
                io.in(roomKey).emit("timeUpdate", { time: battle.time });
              } else {
                clearInterval(gameRooms[roomKey].timer);
                gameRooms[roomKey].timer = undefined;
                // todo: send time's up
              }
            }, 1000);
          }, 2000);
        }

        // if the battle is in play and we are receiving a ready... ask them to update
        if (!!battle.ready && gameRooms[roomKey].timer) {
          const rounds = getMatchupDescriptions(gameRooms[roomKey]);
          socket.emit("gameUpdate", {
            rounds,
            currentRound,
            currentBattle,
            battle,
          });
        }
      }
    });

    // process moves
    socket.on("sendMoves", async (args) => {
      const BLOCKED_DAMAGE = 30;
      const FULL_DAMAGE = 60;
      const { roomKey, attack, defend } = args;
      const roomInfo = gameRooms[roomKey];

      console.log(
        `room:${roomKey} player:${socket.id} (a:${attack} d:${defend})`
      );

      if (roomInfo?.started) {
        let { currentRound, currentBattle } = roomInfo;

        if (currentRound < roomInfo.rounds?.length) {
          const round = roomInfo.rounds[currentRound];

          if (currentBattle < round.battles.length) {
            const battle = round?.battles[currentBattle];
            let winningPlayer = undefined;

            if (battle.player1.id === socket.id) {
              battle.player1NeedInput = false;
              const { player1NeedInput, player2NeedInput } = battle;

              io.in(roomKey).emit("moveUpdate", {
                player1NeedInput,
                player2NeedInput,
              });

              // if battling the cpu then resolve player1 moves first
              if (!battle.player2) {
                const cpuAttack = getRandomInt(1, 4);
                const cpuDefend = getRandomInt(1, 4);

                console.log(`CPU attack: ${cpuAttack} defend: ${cpuDefend}`);

                const seq1 = {
                  playerId: battle.player1.id,
                  attack,
                  opponentResponse: cpuDefend,
                };
                battle.moves.push(seq1);
                battle.cpuHealth -=
                  attack === cpuDefend ? BLOCKED_DAMAGE : FULL_DAMAGE;

                await delay(1000).then(() => {
                  io.in(roomKey).emit("battleUpdate", {
                    battle,
                    sequence: seq1,
                    reset: false,
                  });
                  if (battle.cpuHealth > 0) {
                    battle.moves.push({
                      playerId: "cpu",
                      attack: cpuAttack,
                      opponentResponse: defend,
                    });
                    battle.player1.health -=
                      cpuAttack === defend ? BLOCKED_DAMAGE : FULL_DAMAGE;

                    if (battle.player1.health <= 0) {
                      battle.winner = `CPU def. ${battle.player1.name}`;
                    }
                  } else {
                    battle.winner = `${battle.player1.name} def. CPU`;
                    winningPlayer = battle.player1;
                  }
                });
              } else if (battle.moves?.length > 1) {
                battle.moves[0].opponentResponse = defend;
                battle.moves[1].attack = attack;
                battle.player1.health -=
                  battle.moves[0].attack === defend
                    ? BLOCKED_DAMAGE
                    : FULL_DAMAGE;

                if (battle.player1.health > 0) {
                  battle.player2.health -=
                    attack === battle.moves[1].opponentResponse
                      ? BLOCKED_DAMAGE
                      : FULL_DAMAGE;

                  if (battle.player2.health <= 0) {
                    battle.winner = `${battle.player1.name} def. ${battle.player2.name}`;
                    winningPlayer = battle.player1;
                  }
                } else {
                  battle.moves.splice(1, 1);
                  battle.winner = `${battle.player2.name} def. ${battle.player1.name}`;
                  winningPlayer = battle.player2;
                }
              } else {
                // otherwise just store the moves
                battle.moves.push({
                  playerId: battle.player1.id,
                  attack,
                  opponentResponse: 0,
                });
                battle.moves.push({
                  playerId: battle.player2.id,
                  attack: 0,
                  opponentResponse: defend,
                });
                return;
              }
            } else if (battle.player2?.id === socket.id) {
              battle.player2NeedInput = false;
              const { player1NeedInput, player2NeedInput } = battle;
              io.in(roomKey).emit("moveUpdate", {
                player1NeedInput,
                player2NeedInput,
              });

              // if player1 has moved then resolve their moves first
              if (battle.moves?.length > 1) {
                battle.moves[0].opponentResponse = defend;
                battle.moves[1].attack = attack;
                battle.player2.health -=
                  battle.moves[0].attack === defend
                    ? BLOCKED_DAMAGE
                    : FULL_DAMAGE;

                if (battle.player2.health > 0) {
                  battle.player1.health -=
                    attack === battle.moves[1].opponentResponse
                      ? BLOCKED_DAMAGE
                      : FULL_DAMAGE;

                  if (battle.player1.health <= 0) {
                    battle.winner = `${battle.player2.name} def. ${battle.player1.name}`;
                    winningPlayer = battle.player2;
                  }
                } else {
                  battle.moves.splice(1, 1);
                  battle.winner = `${battle.player1.name} def. ${battle.player2.name}`;
                  winningPlayer = battle.player1;
                }
              } else {
                // otherwise just store until they do
                battle.moves.push({
                  playerId: battle.player2.id,
                  attack,
                  opponentResponse: 0,
                });
                battle.moves.push({
                  playerId: battle.player1.id,
                  attack: 0,
                  opponentResponse: defend,
                });
                return;
              }
            }

            if (battle.winner) {
              if (!moveWinnerToNextRound(roomInfo, winningPlayer)) {
                // set final winner
              }

              currentBattle++;
              if (round.battles.length <= currentBattle) {
                currentRound++;
                currentBattle = 0;
              }
              roomInfo.currentRound = currentRound;
              roomInfo.currentBattle = currentBattle;

              // setTimeout(() => {
              //   const rounds = getMatchupDescriptions(gameRooms[roomKey]);
              //   io.in(roomKey).emit("showMatchups", {
              //     rounds,
              //     currentRound,
              //     currentBattle,
              //   });

              //   if (currentRound < gameRooms[roomKey].rounds.length) {
              //     setTimeout(() => {
              //       const battle =
              //         gameRooms[roomKey].rounds[currentRound].battles[
              //           currentBattle
              //         ];
              //       io.in(roomKey).emit("fight", { battle });
              //     }, 8000);
              //   }
              // }, 3000);
            }
          }
        }
      }
    });

    // counter ran out
    socket.on("timesUp", (args) => {
      const { roomKey } = args;
      const roomInfo = gameRooms[roomKey];
      if (roomInfo?.started) {
        let { currentRound, currentBattle } = roomInfo;

        if (currentRound < roomInfo.rounds?.length) {
          const round = roomInfo.rounds[currentRound];

          if (currentBattle < round.battles.length) {
            const battle = round?.battles[currentBattle];
            let winningPlayer = undefined;

            if (!battle.winner) {
              // determine who wins based on health remaining...
              if (
                battle.player1.health !==
                (battle.player2?.health ?? battle.cpuHealth)
              ) {
                if (battle.player2) {
                  if (battle.player2.health > battle.player1.health) {
                    battle.winner = `${battle.player2.name} def. ${battle.player1.name}`;
                    battle.player1.health = 0;
                    winningPlayer = battle.player2;
                  } else {
                    battle.winner = `${battle.player1.name} def. ${battle.player2.name}`;
                    battle.player2.health = 0;
                    winningPlayer = battle.player1;
                  }
                } else {
                  if (battle.cpuHealth > battle.player1.health) {
                    battle.winner = `CPU def. ${battle.player1.name}`;
                    battle.player1.health = 0;
                  } else {
                    battle.winner = `${battle.player1.name} def. CPU`;
                    battle.cpuHealth = 0;
                    winningPlayer = battle.player1;
                  }
                }
              } else if (battle.moves.length > 0) {
                // if that's equal then whoever has already made a move this battle...
                if (battle.moves[0].playerId === battle.player1.id) {
                  battle.winner = `${battle.player1.name} def. ${battle.player2.name}`;
                  battle.player2.health = 0;
                  winningPlayer = battle.player1;
                } else {
                  battle.winner = `${battle.player2.name} def. ${battle.player1.name}`;
                  battle.player1.health = 0;
                  winningPlayer = battle.player2;
                }
              } else {
                // if still no one then player 1 wins arbitrarily
                battle.winner = `${battle.player1.name} by default`;
                if (battle.player2) {
                  battle.player2.health = 0;
                } else {
                  battle.cpuHealth = 0;
                }
                winningPlayer = battle.player1;
              }

              const battleUpdate = { ...battle, moves: [] };

              io.in(roomKey).emit("battleComplete", { battleUpdate });

              if (!moveWinnerToNextRound(roomInfo, winningPlayer)) {
                // set final winner
              }

              currentBattle++;
              if (round.battles.length <= currentBattle) {
                currentRound++;
                currentBattle = 0;
              }
              roomInfo.currentRound = currentRound;
              roomInfo.currentBattle = currentBattle;

              setTimeout(() => {
                const rounds = getMatchupDescriptions(gameRooms[roomKey]);
                io.in(roomKey).emit("showMatchups", {
                  rounds,
                  currentRound,
                  currentBattle,
                });

                if (currentRound < gameRooms[roomKey].rounds.length) {
                  setTimeout(() => {
                    const battle =
                      gameRooms[roomKey].rounds[currentRound].battles[
                        currentBattle
                      ];
                    io.in(roomKey).emit("fight", { battle });
                  }, 8000);
                }
              }, 3000);
            }
          }
        }
      }
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

function getRandomInt(min, max) {
  const minCeiled = Math.ceil(min);
  const maxFloored = Math.floor(max);
  // The maximum is exclusive and the minimum is inclusive
  return Math.floor(Math.random() * (maxFloored - minCeiled) + minCeiled);
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

function createRounds(players) {
  const orderedPairs = Object.values(players)
    .sort((a, b) => (a.id < b.id ? -1 : 1))
    .reduce(function (result, value, index, arr) {
      if (index % 2 === 0) {
        result.push(arr.slice(index, index + 2).map((p) => p.id));
      }
      return result;
    }, []);

  const round = {
    name: "Round 1",
    battles: [],
  };

  orderedPairs.forEach((pair, i) => {
    const player1 = players[pair[0]];
    const battle = {
      player1: { ...player1, id: pair[0], health: 100 },
      moves: [],
      time: 60,
      player1NeedInput: true,
    };
    if (pair.length > 1 && pair[1] !== undefined) {
      const player2 = players[pair[1]];
      battle.player2 = { ...player2, id: pair[1], health: 100 };
      battle.player2NeedInput = true;
    } else {
      battle.cpuHealth = 100;
    }
    round.battles.push(battle);
  });

  return [round];
}

function moveWinnerToNextRound(roomInfo, winner) {
  const { rounds, currentRound } = roomInfo;
  let placed = false;
  if (rounds[currentRound].battles > 1) {
    if (rounds.length <= currentRound + 1) {
      rounds.push({ name: `Round ${rounds.length + 1}`, battles: [] });
    }
    rounds[currentRound + 1].battles.forEach((battle) => {
      if (!battle.player1 && !placed) {
        battle.player1 = { ...winner, health: 100 };
        placed = true;
      }
      if (!battle.player2 && !placed) {
        battle.player2 = { ...winner, health: 100 };
        battle.player2NeedInput = true;
        placed = true;
      }
    });
    if (!placed) {
      rounds[currentRound + 1].battles.push({
        player1: { ...winner, health: 100 },
        moves: [],
        time: 60,
        player1NeedInput: true,
      });
      placed = true;
    }
  }
  return placed;
}

function getMatchupDescriptions(roomInfo) {
  const { rounds, currentRound, currentBattle, players } = roomInfo;
  let finalWinner = "";
  if (rounds[rounds.length - 1].battles.length === 1) {
    const lastBattle = rounds[rounds.length - 1].battles[0];
    if (!!lastBattle.winner) {
      finalWinner =
        lastBattle.player1.health <= 0
          ? battle.player2?.name ?? "CPU"
          : battle.player1.name;
    }
  }
  const matchups = rounds.map((round, r) => {
    return {
      name: round.name,
      battles: round.battles.map((battle, b) => {
        if (r < currentRound || (r === currentRound && b < currentBattle)) {
          return battle.winner;
        }
        const p1 = battle.player1 ? players[battle.player1.id] : undefined;
        const p2 = battle.player2 ? players[battle.player2.id] : undefined;
        if (r > currentRound) {
          return `${p1?.name ?? "???"} vs. ${p2?.name ?? "???"}`;
        }
        return b.resultText ?? `${p1?.name ?? "CPU"} vs. ${p2?.name ?? "CPU"}`;
      }),
    };
  });
  if (finalWinner?.length) {
    matchups.push({ name: "Winner", battles: [finalWinner] });
  }
  return matchups;
}

function delay(t, val) {
  return new Promise((resolve) => setTimeout(resolve, t, val));
}
