// Test harness: runs the real game socket handlers (server/socket) on an
// in-process Socket.IO server and drives it with real socket.io clients,
// exactly the way browsers do.
const http = require("http");
const { Server } = require("socket.io");
const { io: ioClient } = require("socket.io-client");

// The server logs every move and bracket redraw; keep test output readable.
if (!process.env.DEBUG) console.log = () => {};

// Battle timers run for 60s. Unref them so a test file can exit as soon as
// its tests finish instead of waiting for leftover timers.
const realSetInterval = global.setInterval;
global.setInterval = (...args) => {
  const t = realSetInterval(...args);
  t?.unref?.();
  return t;
};

const registerGameHandlers = require("../server/socket");

async function startServer() {
  const httpServer = http.createServer();
  const io = new Server(httpServer);
  const errors = [];

  // Wrap every handler the game registers so an exception is recorded instead
  // of killing the test process. (In production an exception here kills the
  // whole server; see robustness.test.js.)
  io.on("connection", (socket) => {
    const on = socket.on.bind(socket);
    socket.on = (event, fn) =>
      on(event, (...args) => {
        try {
          const r = fn(...args);
          if (r && typeof r.catch === "function") r.catch((e) => errors.push(e));
        } catch (e) {
          errors.push(e);
        }
      });
  });
  registerGameHandlers(io);

  await new Promise((resolve) => httpServer.listen(0, resolve));
  const { port } = httpServer.address();
  const clients = [];

  return {
    url: `http://localhost:${port}`,
    errors,
    async connect() {
      const socket = ioClient(`http://localhost:${port}`, {
        transports: ["websocket"],
        forceNew: true,
        reconnection: false,
      });
      clients.push(socket);
      await waitFor(socket, "connect");
      return socket;
    },
    async close() {
      clients.forEach((c) => c.disconnect());
      await new Promise((resolve) => io.close(() => resolve()));
    },
  };
}

function waitFor(socket, event, { timeout = 5000, filter } = {}) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off(event, handler);
      reject(new Error(`Timed out after ${timeout}ms waiting for "${event}"`));
    }, timeout);
    function handler(...args) {
      if (filter && !filter(...args)) return;
      clearTimeout(timer);
      socket.off(event, handler);
      resolve(args[0]);
    }
    socket.on(event, handler);
  });
}

// Resolves with the first payload if the event arrives within `ms`, else null.
function nextEventWithin(socket, event, ms) {
  return waitFor(socket, event, { timeout: ms }).catch(() => null);
}

function emitWithAck(socket, event, args, timeout = 2000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`No ack for "${event}" within ${timeout}ms`)),
      timeout
    );
    socket.emit(event, args, (answer) => {
      clearTimeout(timer);
      resolve(answer);
    });
  });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function profile(name) {
  return {
    playerName: name,
    hairColor: "#111111",
    skinColor: "#222222",
    eyeColor: "#333333",
    giColor: "#444444",
  };
}

async function createRoom(socket, name) {
  const created = waitFor(socket, "roomCreated");
  socket.emit("createGame", profile(name));
  return created;
}

// Same two-step flow the browser uses: validate the code, then join.
async function joinRoom(socket, code, name) {
  const valid = waitFor(socket, "codeIsValid");
  socket.emit("isCodeValid", { joinCode: code });
  const joinCode = await valid;
  const joined = waitFor(socket, "roomJoined");
  socket.emit("joinRoom", { ...profile(name), joinCode });
  return joined;
}

// Creates a room with the given player names (first one hosts) and starts it.
async function startGame(server, names) {
  const players = [];
  const host = await server.connect();
  const { roomKey } = await createRoom(host, names[0]);
  players.push({ name: names[0], socket: host });
  for (const name of names.slice(1)) {
    const socket = await server.connect();
    await joinRoom(socket, roomKey, name);
    players.push({ name, socket });
  }
  const updates = players.map((p) => waitFor(p.socket, "gameUpdate"));
  host.emit("startGame", { roomKey });
  const [update] = await Promise.all(updates);
  return makeGame(roomKey, players, update);
}

function makeGame(roomKey, players, update) {
  const game = {
    roomKey,
    players,
    host: players[0].socket,
    state: update, // latest { battle, rounds, currentRound, currentBattle }
    byId(id) {
      return players.find((p) => p.socket.id === id)?.socket;
    },
    connected() {
      return players.filter((p) => p.socket.connected).map((p) => p.socket);
    },
    fighters() {
      const { battle } = game.state;
      return {
        p1: game.byId(battle.player1?.id),
        p2: battle.player2 ? game.byId(battle.player2.id) : undefined,
      };
    },
  };
  return game;
}

// A fighter in the first battle says they're ready; the server starts it.
async function readyFirstBattle(game) {
  const { p1 } = game.fighters();
  const ready = waitFor(game.host, "ready", { timeout: 4000 });
  p1.emit("sendReady", {
    roomKey: game.roomKey,
    currentRound: game.state.currentRound,
    currentBattle: game.state.currentBattle,
  });
  await ready;
}

// Collects battleUpdates until `count` arrive or one reports a winner.
function collectBattleUpdates(observer, count = 2, timeout = 6000) {
  return new Promise((resolve, reject) => {
    const updates = [];
    const timer = setTimeout(() => {
      observer.off("battleUpdate", handler);
      reject(
        new Error(
          `Expected ${count} battleUpdate(s) within ${timeout}ms, got ${updates.length}`
        )
      );
    }, timeout);
    function handler(u) {
      updates.push(u);
      if (updates.length >= count || u.battle?.winner) {
        clearTimeout(timer);
        observer.off("battleUpdate", handler);
        resolve(updates);
      }
    }
    observer.on("battleUpdate", handler);
  });
}

// One exchange. `first` submits before `second`; for a CPU battle pass no second.
async function exchange(game, first, firstMoves, second, secondMoves) {
  const done = collectBattleUpdates(game.host, 2);
  first.emit("sendMoves", { roomKey: game.roomKey, ...firstMoves });
  if (second) {
    await sleep(50);
    second.emit("sendMoves", { roomKey: game.roomKey, ...secondMoves });
  }
  return done;
}

// Winner attacks first and blocks; loser never blocks. KO in two exchanges.
async function playToKO(game, winner, loser) {
  let last;
  for (let i = 0; i < 4; i++) {
    const updates = await exchange(
      game,
      winner,
      { attack: 1, defend: 1 },
      loser,
      { attack: 1, defend: 2 }
    );
    last = updates[updates.length - 1];
    if (last.battle.winner) return last;
  }
  throw new Error("Battle did not end after 4 exchanges");
}

// Requires Math.random patched to 0 (CPU always attacks/defends High = 1).
async function beatCpu(game, player) {
  for (let i = 0; i < 4; i++) {
    const updates = await exchange(game, player, { attack: 2, defend: 1 });
    const last = updates[updates.length - 1];
    if (last.battle.winner) return last;
  }
  throw new Error(
    "CPU battle did not end after 4 exchanges (cpuHealth=" +
      JSON.stringify(game.state.battle.cpuHealth) +
      ")"
  );
}

// Plays the current battle so player1 wins.
async function playCurrentBattle(game) {
  const { p1, p2 } = game.fighters();
  if (!p1) throw new Error("Current battle has no connected player1");
  return game.state.battle.player2 ? playToKO(game, p1, p2) : beatCpu(game, p1);
}

// Every connected player presses READY on the result screen.
async function everyoneNext(game) {
  const next = waitFor(game.host, "next", { timeout: 4000 }).then((u) => ({
    type: "next",
    u,
  }));
  const over = waitFor(game.host, "gameOver", { timeout: 4000 }).then((u) => ({
    type: "gameOver",
    u,
  }));
  const result = Promise.race([next, over]);
  next.catch(() => {});
  over.catch(() => {});
  for (const s of game.connected()) {
    s.emit("sendNext", {
      roomKey: game.roomKey,
      currentRound: game.state.currentRound,
      currentBattle: game.state.currentBattle,
    });
  }
  const { type, u } = await result;
  if (type === "next") game.state = u;
  return { type, payload: u };
}

function withRandom(value, fn) {
  const real = Math.random;
  Math.random = () => value;
  return Promise.resolve()
    .then(fn)
    .finally(() => {
      Math.random = real;
    });
}

module.exports = {
  startServer,
  waitFor,
  nextEventWithin,
  emitWithAck,
  sleep,
  profile,
  createRoom,
  joinRoom,
  startGame,
  readyFirstBattle,
  collectBattleUpdates,
  exchange,
  playToKO,
  beatCpu,
  playCurrentBattle,
  everyoneNext,
  withRandom,
};
