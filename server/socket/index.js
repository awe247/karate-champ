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

    // client has asked if moves are required
    socket.on("checkMovesSent", (args, callback) => {
      const { roomKey } = args;
      if (gameRooms[roomKey]?.started) {
        const { currentRound, currentBattle } = gameRooms[roomKey];
        const battle =
          gameRooms[roomKey].rounds[currentRound].battles[currentBattle];
        let moveSent = false;

        if (
          battle.ready &&
          !battle.winner &&
          (battle?.player1?.id === socket?.id ||
            battle?.player2?.id === socket?.id) &&
          battle.moves?.length > 1
        ) {
          movesSent =
            battle.moves[0].playerId === socket?.id ||
            (battle.moves[1].playerId === socket?.id &&
              battle.moves[1].attack !== 0);
        }

        callback(moveSent);
      }
    });

    // client has asked for the state of the input controls
    socket.on("checkInputStatus", (args, callback) => {
      const { roomKey } = args;
      let showP1 = false;
      let showP2 = false;
      let showInputsP1 = false;
      let showInputsP2 = false;

      if (gameRooms[roomKey]?.started) {
        const { currentRound, currentBattle } = gameRooms[roomKey];
        const battle =
          gameRooms[roomKey].rounds[currentRound].battles[currentBattle];

        if (battle.ready && !battle.winner) {
          const id1 = battle?.player1?.id;
          const id2 = battle?.player2?.id;
          if (!!id1?.length) {
            showP1 = true;
            if (battle.moves?.length > 1) {
              showP1 =
                (battle.moves[0].playerId !== id1 &&
                  battle.moves[1].playerId !== id1) ||
                (battle.moves[1].playerId === id1 &&
                  battle.moves[1].attack === 0);
            }
            showInputsP1 = showP1 && id1 === socket.id;
          }
          if (!!id2?.length) {
            showP2 = true;
            if (battle.moves?.length > 1) {
              showP2 =
                (battle.moves[0].playerId !== id2 &&
                  battle.moves[1].playerId !== id2) ||
                (battle.moves[1].playerId === id2 &&
                  battle.moves[1].attack === 0);
            }
            showInputsP2 = showP2 && id2 === socket.id;
          }
        }
      }

      callback({
        showP1,
        showP2,
        showInputsP1,
        showInputsP2,
      });
    });

    socket.on("sendNext", (args) => {
      const { roomKey, currentRound, currentBattle } = args;
      if (gameRooms[roomKey].started) {
        if (gameRooms[roomKey].finalWinner) {
          // todo: go to the end scene
          const rounds = getMatchupDescriptions(
            gameRooms[roomKey],
            gameRooms[roomKey].finalWinner
          );
          io.in(roomKey).emit("gameOver", { rounds });
        } else {
          let battle =
            gameRooms[roomKey].rounds[currentRound].battles[currentBattle];

          if (battle.ready && battle.winner) {
            if (!battle.waiting?.length) {
              battle.waiting = [socket.id];
            }

            if (!battle.waiting.includes(socket.id)) {
              battle.waiting.push(socket.id);
            }

            // todo: maybe add this to disconnect as well in case the last person waiting leaves?
            if (battle.waiting.length === gameRooms[roomKey].numPlayers) {
              const { currentRound, currentBattle } = gameRooms[roomKey];
              let b = currentBattle + 1;
              let r = currentRound;
              if (gameRooms[roomKey].rounds[currentRound].battles.length <= b) {
                r = currentRound + 1;
                b = 0;
              }

              battle = gameRooms[roomKey].rounds[r].battles[b];
              gameRooms[roomKey].currentRound = r;
              gameRooms[roomKey].currentBattle = b;
              battle.ready = true;

              const rounds = getMatchupDescriptions(gameRooms[roomKey]);
              io.in(roomKey).emit("next", {
                rounds,
                battle,
                currentRound: r,
                currentBattle: b,
              });

              gameRooms[roomKey].timer = setInterval(() => {
                if (battle.time > 0) {
                  battle.time--;
                  io.in(roomKey).emit("timeUpdate", { time: battle.time });
                } else {
                  clearInterval(gameRooms[roomKey].timer);
                  delete gameRooms[roomKey].timer;

                  // time's up
                  const wr = gameRooms[roomKey].currentRound;
                  const wb = gameRooms[roomKey].currentBattle;
                  const timeUpBattle =
                    gameRooms[roomKey].rounds[wr].battles[wb];
                  if (!timeUpBattle.winner) {
                    timeUpBattle.winner = `${timeUpBattle.player1.name} by default`;
                    const winningPlayer = timeUpBattle.player1;
                    if (!moveWinnerToNextRound(roomKey, winningPlayer)) {
                      console.log(gameRooms[roomKey].rounds?.length);
                      gameRooms[roomKey].finalWinner = winningPlayer ?? {
                        id: "cpu",
                        name: "CPU",
                      };
                    }

                    io.in(roomKey).emit("battleUpdate", {
                      battle: timeUpBattle,
                      hidePlayer1: true,
                      hidePlayer2: true,
                    });
                  }
                }
              }, 1000);
            }
          }
        }
      }
    });

    socket.on("sendReady", (args) => {
      const { roomKey, currentRound, currentBattle } = args;
      if (currentRound === undefined || currentBattle === undefined) return;

      if (gameRooms[roomKey].started) {
        const battle =
          gameRooms[roomKey].rounds[currentRound].battles[currentBattle];

        if (
          gameRooms[roomKey].currentRound === currentRound &&
          gameRooms[roomKey].currentBattle === currentBattle
        ) {
          // want at least one of the players in the battle
          if (
            !battle.ready &&
            (battle.player1?.id === socket.id ||
              battle.player2?.id === socket.id)
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
                  delete gameRooms[roomKey].timer;

                  // todo: send time's up
                  const wr = gameRooms[roomKey].currentRound;
                  const wb = gameRooms[roomKey].currentBattle;
                  const timeUpBattle =
                    gameRooms[roomKey].rounds[wr].battles[wb];
                  if (!timeUpBattle.winner) {
                    timeUpBattle.winner = `${timeUpBattle.player1.name} by default`;
                    const winningPlayer = timeUpBattle.player1;
                    if (!moveWinnerToNextRound(roomKey, winningPlayer)) {
                      console.log(gameRooms[roomKey].rounds?.length);
                      gameRooms[roomKey].finalWinner = winningPlayer ?? {
                        id: "cpu",
                        name: "CPU",
                      };
                    }

                    io.in(roomKey).emit("battleUpdate", {
                      battle: timeUpBattle,
                      hidePlayer1: true,
                      hidePlayer2: true,
                    });
                  }
                }
              }, 1000);
            }, 2000);
          }
        } else {
          // if the battle is in play and we are receiving a ready...
          // or if the battle is over... ask them to update
          if ((!!battle.ready && gameRooms[roomKey].timer) || !!battle.winner) {
            const rounds = getMatchupDescriptions(gameRooms[roomKey]);
            const newBattle =
              gameRooms[roomKey].rounds[gameRooms[roomKey].currentRound]
                .battles[gameRooms[roomKey].currentBattle];
            socket.emit("gameUpdate", {
              rounds,
              currentRound: gameRooms[roomKey].currentRound,
              currentBattle: gameRooms[roomKey].currentBattle,
              battle: newBattle,
            });
          }
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
              io.in(roomKey).emit("moveUpdate", { hidePlayer1: true });

              // if battling the cpu then resolve player1 moves first
              if (!battle.player2) {
                const cpuAttack = getRandomInt(1, 4);
                const cpuDefend = getRandomInt(1, 4);

                console.log(`CPU attack: ${cpuAttack} defend: ${cpuDefend}`);

                await delay(1000).then(async () => {
                  const seq1 = {
                    playerId: battle.player1.id,
                    attack,
                    opponentResponse: cpuDefend,
                  };

                  battle.cpuHealth -=
                    attack === cpuDefend ? BLOCKED_DAMAGE : FULL_DAMAGE;

                  let battleIsOver = battle.cpuHealth <= 0;
                  if (battleIsOver) {
                    battle.winner = `${battle.player1.name} def. CPU`;
                    winningPlayer = battle.player1;
                  }

                  io.in(roomKey).emit("battleUpdate", {
                    battle,
                    sequence: seq1,
                    hidePlayer1: battleIsOver,
                  });

                  if (!battleIsOver) {
                    await delay(1000).then(() => {
                      const seq2 = {
                        playerId: "cpu",
                        attack: cpuAttack,
                        opponentResponse: defend,
                      };

                      battle.player1.health -=
                        cpuAttack === defend ? BLOCKED_DAMAGE : FULL_DAMAGE;

                      battleIsOver = battle.player1.health <= 0;
                      if (battleIsOver) {
                        battle.winner = `CPU def. ${battle.player1.name}`;
                      }

                      io.in(roomKey).emit("battleUpdate", {
                        battle,
                        sequence: seq2,
                        hidePlayer1: battleIsOver,
                      });
                    });
                  }
                });
              } else if (battle.moves?.length > 1) {
                // player 1 somehow already registered moves
                if (battle.moves[0].playerId === battle.player1.id) {
                  return;
                }

                console.log(`P1 attack: ${attack} defend: ${defend}`);

                const seq2 = battle.moves.pop();
                const seq1 = battle.moves.pop();
                seq1.opponentResponse = defend;
                seq2.attack = attack;

                await delay(1000).then(async () => {
                  battle.player1.health -=
                    seq1.attack === defend ? BLOCKED_DAMAGE : FULL_DAMAGE;

                  let battleIsOver = battle.player1.health <= 0;
                  if (battleIsOver) {
                    battle.winner = `${battle.player2.name} def. ${battle.player1.name}`;
                    winningPlayer = battle.player2;
                  }

                  io.in(roomKey).emit("battleUpdate", {
                    battle,
                    sequence: seq1,
                    hidePlayer1: battleIsOver,
                    hidePlayer2: battleIsOver,
                  });

                  if (!battleIsOver) {
                    await delay(1000).then(() => {
                      battle.player2.health -=
                        attack === seq2.opponentResponse
                          ? BLOCKED_DAMAGE
                          : FULL_DAMAGE;

                      battleIsOver = battle.player2.health <= 0;
                      if (battleIsOver) {
                        battle.winner = `${battle.player1.name} def. ${battle.player2.name}`;
                        winningPlayer = battle.player1;
                      }

                      io.in(roomKey).emit("battleUpdate", {
                        battle,
                        sequence: seq2,
                        hidePlayer1: battleIsOver,
                        hidePlayer2: battleIsOver,
                      });
                    });
                  }
                });
              } else {
                // otherwise just store the moves
                console.log(`P1 attack: ${attack} defend: ${defend}`);

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
              }
            } else if (battle.player2?.id === socket.id) {
              io.in(roomKey).emit("moveUpdate", { hidePlayer2: true });

              // if player has moved then resolve their moves first
              if (battle.moves?.length > 1) {
                // player 2 somehow already registered moves
                if (battle.moves[0].playerId === battle.player2.id) {
                  return;
                }

                console.log(`P2 attack: ${attack} defend: ${defend}`);

                const seq2 = battle.moves.pop();
                const seq1 = battle.moves.pop();
                seq1.opponentResponse = defend;
                seq2.attack = attack;

                await delay(1000).then(async () => {
                  battle.player2.health -=
                    seq1.attack === defend ? BLOCKED_DAMAGE : FULL_DAMAGE;

                  let battleIsOver = battle.player2.health <= 0;
                  if (battleIsOver) {
                    battle.winner = `${battle.player1.name} def. ${battle.player2.name}`;
                    winningPlayer = battle.player1;
                  }

                  io.in(roomKey).emit("battleUpdate", {
                    battle,
                    sequence: seq1,
                    hidePlayer1: battleIsOver,
                    hidePlayer2: battleIsOver,
                  });

                  if (!battleIsOver) {
                    await delay(1000).then(() => {
                      battle.player1.health -=
                        attack === seq2.opponentResponse
                          ? BLOCKED_DAMAGE
                          : FULL_DAMAGE;

                      battleIsOver = battle.player1.health <= 0;
                      if (battleIsOver) {
                        battle.winner = `${battle.player2.name} def. ${battle.player1.name}`;
                        winningPlayer = battle.player2;
                      }

                      io.in(roomKey).emit("battleUpdate", {
                        battle,
                        sequence: seq2,
                        hidePlayer1: battleIsOver,
                        hidePlayer2: battleIsOver,
                      });
                    });
                  }
                });
              } else {
                console.log(`P2 attack: ${attack} defend: ${defend}`);

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
              }
            }

            if (battle.winner) {
              clearInterval(gameRooms[roomKey].timer);
              delete gameRooms[roomKey].timer;
              if (!moveWinnerToNextRound(roomKey, winningPlayer)) {
                console.log(gameRooms[roomKey].rounds?.length);
                gameRooms[roomKey].finalWinner = winningPlayer ?? {
                  id: "cpu",
                  name: "CPU",
                };
              }
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
        if (gameRooms[keys1]?.players?.length) {
          Object.keys(gameRooms[keys1].players).map((el) => {
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
    };
    if (pair.length > 1 && pair[1] !== undefined) {
      const player2 = players[pair[1]];
      battle.player2 = { ...player2, id: pair[1], health: 100 };
    } else {
      battle.cpuHealth = 100;
    }
    round.battles.push(battle);
  });

  return [round];
}

function drawRounds(rounds) {
  rounds.forEach((round) => {
    console.log(`${round.name} (${round.battles.length})`);
    round.battles.forEach((b) => {
      console.log(`- ${b.player1.name} > ${b.player2?.name}`);
    });
  });
}

function moveWinnerToNextRound(roomKey, winner) {
  const { rounds, currentRound } = gameRooms[roomKey];
  let placed = false;
  console.log(`currentRound = ${currentRound} rounds = ${rounds.length}`);
  if (rounds[currentRound].battles?.length > 1) {
    if (rounds.length <= currentRound + 1) {
      rounds.push({ name: `Round ${rounds.length + 1}`, battles: [] });
      console.log(`adding round (${rounds.length}) current=${currentRound}`);
    }
    rounds[currentRound + 1].battles.forEach((battle) => {
      if (!battle.player1 && !placed) {
        battle.player1 = { ...winner, health: 100 };
        placed = true;
      }
      if (!battle.player2 && !placed) {
        battle.player2 = { ...winner, health: 100 };
        placed = true;
      }
    });
    if (!placed) {
      console.log(`creating a new battle in round ${currentRound + 1}`);
      rounds[currentRound + 1].battles.push({
        player1: { ...winner, health: 100 },
        moves: [],
        time: 60,
      });
      placed = true;
    }
  }
  drawRounds(rounds);
  return placed;
}

function getMatchupDescriptions(roomInfo, finalWinner) {
  const { rounds, currentRound, currentBattle, players } = roomInfo;
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
  matchups.push({ name: "Winner", battles: [finalWinner?.name ?? "???"] });
  return matchups;
}

function delay(t, val) {
  return new Promise((resolve) => setTimeout(resolve, t, val));
}
