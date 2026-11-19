// Tournament server. The rules this implements are written down in
// test/EXPECTED_BEHAVIOR.md and checked by `npm test`.

const MAX_PLAYERS = 32;
const BATTLE_TIME = 60;
const START_HEALTH = 100;
const BLOCKED_DAMAGE = 30;
const FULL_DAMAGE = 60;
const READY_DELAY = 2000; // "READY... FIGHT!" before the first battle
const STRIKE_DELAY = 1000; // pause before each strike in an exchange
const CPU = Object.freeze({ id: "cpu", name: "CPU" });

const gameRooms = {
  // [roomKey]: {
  //   roomKey, hostId, players: PlayerMap (connected players only),
  //   numPlayers, started, rounds: Round[], currentRound, currentBattle,
  //   timer, finalWinner
  // }
};

module.exports = (io) => {
  io.on("connection", (socket) => {
    console.log(`A socket connection to the server has been made: ${socket.id}`);

    // Every handler is guarded: one bad message must never crash the server
    // (that would end every game running on it).
    const on = (event, handler) =>
      socket.on(event, async (...args) => {
        try {
          await handler(...args);
        } catch (err) {
          console.error(`Error handling "${event}" from ${socket.id}:`, err);
        }
      });

    const emitGameUpdate = (room) => {
      const battle = currentBattleOf(room);
      socket.emit("gameUpdate", {
        rounds: getMatchupDescriptions(room),
        currentRound: room.currentRound,
        currentBattle: room.currentBattle,
        battle: toPublic(battle),
        waiting: !!battle.waiting?.includes(socket.id),
      });
    };

    // create and join the room
    on("createGame", (args = {}) => {
      let key = codeGenerator();
      while (gameRooms[key]) key = codeGenerator();
      const room = {
        roomKey: key,
        hostId: socket.id,
        players: {},
        numPlayers: 0,
        started: false,
        rounds: [],
      };
      gameRooms[key] = room;
      addPlayer(room, socket, args);
      socket.join(key);
      socket.emit("roomCreated", { roomKey: key, players: room.players });
    });

    // check for the existence of a room
    on("isCodeValid", (args = {}) => {
      const joinCode = normalizeCode(args.joinCode);
      const problem = whyCannotJoin(joinCode);
      if (problem) socket.emit("codeNotValid", problem);
      else socket.emit("codeIsValid", joinCode);
    });

    // join the room
    on("joinRoom", (args = {}) => {
      const joinCode = normalizeCode(args.joinCode);
      const problem = whyCannotJoin(joinCode);
      if (problem) {
        socket.emit("codeNotValid", problem);
        return;
      }
      const room = gameRooms[joinCode];
      addPlayer(room, socket, args);
      socket.join(joinCode);
      socket.emit("roomJoined", { roomKey: joinCode, players: room.players });
      socket.to(joinCode).emit("roomUpdate", { players: room.players });
    });

    // start the game (host only, once)
    on("startGame", (args = {}) => {
      const room = gameRooms[args.roomKey];
      if (!room || room.started || room.hostId !== socket.id) return;
      room.started = true;
      room.rounds = [buildRound(1, Object.values(room.players))];
      room.currentRound = 0;
      room.currentBattle = 0;
      const battle = currentBattleOf(room);
      io.in(room.roomKey).emit("gameUpdate", {
        battle: toPublic(battle),
        rounds: getMatchupDescriptions(room),
        currentRound: 0,
        currentBattle: 0,
      });
    });

    // client has requested the latest game state
    on("needUpdate", (args = {}) => {
      const room = gameRooms[args.roomKey];
      if (room?.started) emitGameUpdate(room);
    });

    // client has asked whether its moves for this exchange are in
    on("checkMovesSent", (args = {}, callback) => {
      if (typeof callback !== "function") return;
      const room = gameRooms[args.roomKey];
      const battle = room?.started && currentBattleOf(room);
      callback(!!(battle && battle.pending?.[socket.id]));
    });

    // client has asked for the state of the input controls
    on("checkInputStatus", (args = {}, callback) => {
      if (typeof callback !== "function") return;
      const status = { showP1: false, showP2: false, showInputsP1: false, showInputsP2: false };
      const room = gameRooms[args.roomKey];
      const battle = room?.started && currentBattleOf(room);
      if (battle && battle.live && !battle.winner && !battle.resolving) {
        const id1 = battle.player1?.id;
        const id2 = battle.player2?.id;
        status.showP1 = !!id1 && !battle.pending?.[id1];
        status.showP2 = !!id2 && !battle.pending?.[id2];
        status.showInputsP1 = status.showP1 && id1 === socket.id;
        status.showInputsP2 = status.showP2 && id2 === socket.id;
      }
      callback(status);
    });

    // a player has pressed READY on the result screen
    on("sendNext", (args = {}) => {
      const room = gameRooms[args.roomKey];
      if (!room?.started || !room.players[socket.id]) return;
      // Ignore repeated/stale READYs for a battle that is no longer current.
      if (args.currentRound !== room.currentRound || args.currentBattle !== room.currentBattle) {
        return;
      }
      const battle = currentBattleOf(room);
      if (!battle.winner) return;

      if (room.finalWinner) {
        io.in(room.roomKey).emit("gameOver", { rounds: getMatchupDescriptions(room) });
        return;
      }

      battle.waiting = battle.waiting ?? [];
      if (!battle.waiting.includes(socket.id)) battle.waiting.push(socket.id);
      advanceIfEveryoneWaiting(io, room);
    });

    // a fighter's screen has loaded the first battle
    on("sendReady", (args = {}) => {
      const room = gameRooms[args.roomKey];
      const { currentRound, currentBattle } = args;
      if (!room?.started || currentRound === undefined || currentBattle === undefined) return;

      if (room.currentRound !== currentRound || room.currentBattle !== currentBattle) {
        // This client is behind; bring it up to date.
        emitGameUpdate(room);
        return;
      }

      const battle = currentBattleOf(room);
      if (battle.ready || battle.winner || !isFighter(battle, socket.id)) return;
      battle.ready = true;
      setTimeout(() => {
        if (battle.winner || gameRooms[room.roomKey] !== room) return;
        io.in(room.roomKey).emit("ready");
        startClock(io, room, battle);
      }, READY_DELAY);
    });

    // process moves
    on("sendMoves", async (args = {}) => {
      const room = gameRooms[args.roomKey];
      if (!room?.started) return;
      const battle = currentBattleOf(room);
      const { attack, defend } = args;
      console.log(`room:${args.roomKey} player:${socket.id} (a:${attack} d:${defend})`);

      if (!battle.live || battle.winner || battle.resolving) return;
      if (!isFighter(battle, socket.id)) return;
      if (!isMove(attack) || !isMove(defend)) return;
      battle.pending = battle.pending ?? {};
      battle.order = battle.order ?? [];
      if (battle.pending[socket.id]) return; // already moved this exchange

      battle.pending[socket.id] = { attack, defend };
      battle.order.push(socket.id);
      const isP1 = battle.player1.id === socket.id;
      io.in(room.roomKey).emit("moveUpdate", isP1 ? { hidePlayer1: true } : { hidePlayer2: true });

      if (!battle.player2) {
        await resolveCpuExchange(io, room, battle);
      } else if (battle.order.length === 2) {
        await resolveExchange(io, room, battle);
      }
    });

    // when a player disconnects, remove them and make sure nobody waits on them
    socket.on("disconnect", () => {
      try {
        handleDisconnect(io, socket);
      } catch (err) {
        console.error(`Error handling disconnect of ${socket.id}:`, err);
      }
    });
  });
};

// ---------------------------------------------------------------- lobby

function normalizeCode(code) {
  return typeof code === "string" ? code.trim().toUpperCase() : "";
}

function whyCannotJoin(code) {
  const room = gameRooms[code];
  if (!room) return "Not a valid code.";
  if (room.started) return "Game in progress.";
  if (room.numPlayers >= MAX_PLAYERS) return "Room full.";
  return undefined;
}

function addPlayer(room, socket, args) {
  const { playerName, hairColor, skinColor, eyeColor, giColor } = args;
  room.players[socket.id] = {
    id: socket.id,
    name: typeof playerName === "string" && playerName.trim() ? playerName.trim().slice(0, 20) : "Player",
    hairColor,
    skinColor,
    eyeColor,
    giColor,
  };
  room.numPlayers = Object.keys(room.players).length;
}

function handleDisconnect(io, socket) {
  const room = Object.values(gameRooms).find((r) => r.players[socket.id]);
  if (!room) return;
  console.log("user disconnected: ", socket.id);
  delete room.players[socket.id];
  room.numPlayers = Object.keys(room.players).length;

  if (room.numPlayers === 0) {
    stopClock(room);
    delete gameRooms[room.roomKey];
    return;
  }

  if (!room.started) {
    if (room.hostId === socket.id) {
      room.hostId = Object.keys(room.players)[0];
      io.to(room.hostId).emit("becameHost", { roomKey: room.roomKey, players: room.players });
    }
    io.to(room.roomKey).emit("roomUpdate", { players: room.players });
    return;
  }

  io.to(room.roomKey).emit("roomUpdate", { players: room.players });

  const battle = currentBattleOf(room);
  if (!battle.winner && isFighter(battle, socket.id)) {
    const opponent = battle.player1.id === socket.id ? battle.player2 ?? CPU : battle.player1;
    finishBattle(io, room, battle, opponent, `${opponent.name} wins by forfeit`);
    io.in(room.roomKey).emit("battleUpdate", {
      battle: toPublic(battle),
      hidePlayer1: true,
      hidePlayer2: true,
    });
  }
  advanceIfEveryoneWaiting(io, room);
}

// ---------------------------------------------------------------- bracket

// Pairs entrants in order; an odd one out fights the CPU. Entrants may include
// the CPU itself if it won an earlier battle.
function buildRound(number, entrants) {
  const battles = [];
  for (let i = 0; i < entrants.length; i += 2) {
    const humans = [entrants[i], entrants[i + 1] ?? CPU].filter((e) => e.id !== CPU.id);
    const battle = { moves: [], time: BATTLE_TIME };
    if (humans[0]) battle.player1 = fighter(humans[0]);
    if (humans[1]) battle.player2 = fighter(humans[1]);
    else battle.cpuHealth = START_HEALTH;
    battles.push(battle);
  }
  return { name: `Round ${number}`, battles };
}

function fighter(entrant) {
  const { id, name, hairColor, skinColor, eyeColor, giColor } = entrant;
  return { id, name, hairColor, skinColor, eyeColor, giColor, health: START_HEALTH };
}

function currentBattleOf(room) {
  return room.rounds[room.currentRound].battles[room.currentBattle];
}

function isFighter(battle, id) {
  return battle.player1?.id === id || battle.player2?.id === id;
}

// Records the result. When it was the round's last battle, builds the next
// round from the winners, or crowns the champion.
function finishBattle(io, room, battle, winner, text) {
  if (battle.winner) return;
  battle.winner = text;
  battle.winnerEntrant = winner;
  battle.live = false;
  battle.resolving = false;
  stopClock(room);

  const round = room.rounds[room.currentRound];
  if (round.battles.every((b) => b.winner)) {
    const winners = round.battles.map((b) => b.winnerEntrant);
    if (winners.length === 1) {
      room.finalWinner = winners[0];
    } else {
      room.rounds.push(buildRound(room.rounds.length + 1, winners));
    }
  }
}

// A battle nobody can fight (a fighter has left, or it is CPU vs CPU) is
// decided straight away. Returns true if it was.
function autoResolve(io, room, battle) {
  const here = (p) => p && room.players[p.id];
  const { player1, player2 } = battle;
  if (!player1) {
    finishBattle(io, room, battle, CPU, "CPU advances");
  } else if (player2) {
    if (here(player1) && here(player2)) return false;
    if (here(player2)) finishBattle(io, room, battle, player2, `${player2.name} wins by forfeit`);
    else finishBattle(io, room, battle, player1, `${player1.name} wins by forfeit`);
  } else {
    if (here(player1)) return false;
    finishBattle(io, room, battle, CPU, "CPU wins by forfeit");
  }
  return true;
}

function advanceIfEveryoneWaiting(io, room) {
  const battle = currentBattleOf(room);
  if (!battle.winner || room.finalWinner) return;
  const waiting = battle.waiting ?? [];
  const everyone = Object.keys(room.players).every((id) => waiting.includes(id));
  if (everyone) advance(io, room);
}

function advance(io, room) {
  for (;;) {
    let r = room.currentRound;
    let b = room.currentBattle + 1;
    if (b >= room.rounds[r].battles.length) {
      r += 1;
      b = 0;
    }
    if (!room.rounds[r]) return; // nothing left (champion already decided)
    room.currentRound = r;
    room.currentBattle = b;
    const battle = currentBattleOf(room);

    if (autoResolve(io, room, battle)) {
      if (room.finalWinner) {
        io.in(room.roomKey).emit("gameOver", { rounds: getMatchupDescriptions(room) });
        return;
      }
      continue;
    }

    battle.ready = true;
    startClock(io, room, battle);
    io.in(room.roomKey).emit("next", {
      rounds: getMatchupDescriptions(room),
      battle: toPublic(battle),
      currentRound: r,
      currentBattle: b,
    });
    return;
  }
}

// ---------------------------------------------------------------- fighting

function isMove(value) {
  return value === 1 || value === 2 || value === 3;
}

function damage(attack, defend) {
  return attack === defend ? BLOCKED_DAMAGE : FULL_DAMAGE;
}

function startClock(io, room, battle) {
  stopClock(room);
  battle.live = true;
  room.timer = setInterval(() => {
    if (battle.winner) {
      stopClock(room);
      return;
    }
    battle.time = Math.max(0, battle.time - 1);
    io.in(room.roomKey).emit("timeUpdate", { time: battle.time });
    if (battle.time <= 0) timeUp(io, room, battle);
  }, 1000);
}

function stopClock(room) {
  if (room.timer) clearInterval(room.timer);
  delete room.timer;
}

// More health wins; a tie goes to player 1.
function timeUp(io, room, battle) {
  const p1 = battle.player1;
  const opponent = battle.player2 ?? CPU;
  const opponentHealth = battle.player2 ? battle.player2.health : battle.cpuHealth;
  const winner = opponentHealth > p1.health ? opponent : p1;
  finishBattle(io, room, battle, winner, `${winner.name} wins on time`);
  io.in(room.roomKey).emit("battleUpdate", {
    battle: toPublic(battle),
    hidePlayer1: true,
    hidePlayer2: true,
  });
}

// Both fighters have moved. Whoever moved first strikes first.
async function resolveExchange(io, room, battle) {
  battle.resolving = true;
  const [firstId, secondId] = battle.order;
  const moves = battle.pending;
  battle.pending = {};
  battle.order = [];
  const side = (id) => (battle.player1.id === id ? battle.player1 : battle.player2);
  const strikes = [
    [side(firstId), side(secondId), moves[firstId].attack, moves[secondId].defend],
    [side(secondId), side(firstId), moves[secondId].attack, moves[firstId].defend],
  ];

  for (let i = 0; i < strikes.length; i++) {
    const [attacker, defender, attack, defend] = strikes[i];
    await delay(STRIKE_DELAY);
    if (battle.winner) return; // time ran out or someone left meanwhile
    defender.health -= damage(attack, defend);
    const ko = defender.health <= 0;
    if (ko) finishBattle(io, room, battle, attacker, `${attacker.name} def. ${defender.name}`);
    const last = ko || i === strikes.length - 1;
    if (last) battle.resolving = false;
    const hide = ko || !last; // controls come back only once the exchange is over
    io.in(room.roomKey).emit("battleUpdate", {
      battle: toPublic(battle),
      sequence: { playerId: attacker.id, attack, opponentResponse: defend },
      hidePlayer1: hide,
      hidePlayer2: hide,
    });
    if (ko) return;
  }
}

// Player 1 has moved against the CPU: the player strikes, then the CPU.
async function resolveCpuExchange(io, room, battle) {
  battle.resolving = true;
  const player = battle.player1;
  const { attack, defend } = battle.pending[player.id];
  battle.pending = {};
  battle.order = [];
  const cpuAttack = getRandomInt(1, 4);
  const cpuDefend = getRandomInt(1, 4);
  console.log(`CPU attack: ${cpuAttack} defend: ${cpuDefend}`);

  await delay(STRIKE_DELAY);
  if (battle.winner) return;
  battle.cpuHealth -= damage(attack, cpuDefend);
  let ko = battle.cpuHealth <= 0;
  if (ko) finishBattle(io, room, battle, player, `${player.name} def. CPU`);
  io.in(room.roomKey).emit("battleUpdate", {
    battle: toPublic(battle),
    sequence: { playerId: player.id, attack, opponentResponse: cpuDefend },
    hidePlayer1: true,
  });
  if (ko) return;

  await delay(STRIKE_DELAY);
  if (battle.winner) return;
  player.health -= damage(cpuAttack, defend);
  ko = player.health <= 0;
  if (ko) finishBattle(io, room, battle, CPU, `CPU def. ${player.name}`);
  battle.resolving = false;
  io.in(room.roomKey).emit("battleUpdate", {
    battle: toPublic(battle),
    sequence: { playerId: CPU.id, attack: cpuAttack, opponentResponse: defend },
    hidePlayer1: ko,
  });
}

// ---------------------------------------------------------------- views

// What clients see of a battle (never the opponent's pending move).
function toPublic(battle) {
  if (!battle) return battle;
  const { player1, player2, cpuHealth, time, ready, winner } = battle;
  const winnerName = battle.winnerEntrant?.name;
  return { player1, player2, cpuHealth, time, ready, winner, winnerName, moves: [] };
}

function getMatchupDescriptions(room, finalWinner = room.finalWinner) {
  const { rounds, currentRound, currentBattle } = room;
  const matchups = rounds.map((round, r) => ({
    name: round.name,
    battles: round.battles.map((battle, b) => {
      const done = r < currentRound || (r === currentRound && b < currentBattle);
      if (battle.winner && (done || room.finalWinner)) return battle.winner;
      const p1 = battle.player1?.name ?? "CPU";
      const p2 = battle.player2?.name ?? "CPU";
      return `${p1} vs. ${p2}`;
    }),
  }));
  matchups.push({ name: "Winner", battles: [finalWinner?.name ?? "???"] });
  return matchups;
}

// ---------------------------------------------------------------- utils

function codeGenerator() {
  let code = "";
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ0123456789";
  for (let i = 0; i < 5; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// The maximum is exclusive and the minimum is inclusive
function getRandomInt(min, max) {
  return Math.floor(Math.random() * (Math.floor(max) - Math.ceil(min)) + Math.ceil(min));
}

function delay(t, val) {
  return new Promise((resolve) => setTimeout(resolve, t, val));
}
