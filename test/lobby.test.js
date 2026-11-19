const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const h = require("./helpers");

let server;
before(async () => (server = await h.startServer()));
after(() => server.close());

test("hosting creates a 5-character room code with the host in it", async () => {
  const host = await server.connect();
  const { roomKey, players } = await h.createRoom(host, "Alice");
  assert.match(roomKey, /^[A-HJ-NP-Z0-9]{5}$/);
  assert.deepEqual(Object.values(players).map((p) => p.name), ["Alice"]);
});

test("joining tells the joiner and everyone already in the room", async () => {
  const host = await server.connect();
  const { roomKey } = await h.createRoom(host, "Alice");
  const guest = await server.connect();
  const hostSeesUpdate = h.waitFor(host, "roomUpdate");
  const joined = await h.joinRoom(guest, roomKey, "Bob");
  assert.equal(joined.roomKey, roomKey);
  assert.deepEqual(
    Object.values(joined.players).map((p) => p.name).sort(),
    ["Alice", "Bob"]
  );
  const update = await hostSeesUpdate;
  assert.equal(Object.keys(update.players).length, 2);
});

test("the joiner's chosen name and colours are kept", async () => {
  const host = await server.connect();
  const { roomKey } = await h.createRoom(host, "Alice");
  const guest = await server.connect();
  const joined = await h.joinRoom(guest, roomKey, "Bob");
  const bob = joined.players[guest.id];
  assert.equal(bob.name, "Bob");
  assert.equal(bob.giColor, "#444444");
});

test("an unknown code is rejected", async () => {
  const guest = await server.connect();
  const reply = h.waitFor(guest, "codeNotValid");
  guest.emit("isCodeValid", { joinCode: "ZZZZZ" });
  await reply;
});

test("room codes are case-insensitive (people type them on phones)", async () => {
  const host = await server.connect();
  const { roomKey } = await h.createRoom(host, "Alice");
  const guest = await server.connect();
  const reply = Promise.race([
    h.waitFor(guest, "codeIsValid").then(() => "valid"),
    h.waitFor(guest, "codeNotValid").then(() => "not valid"),
  ]);
  guest.emit("isCodeValid", { joinCode: roomKey.toLowerCase() });
  assert.equal(await reply, "valid");
});

test("a game in progress cannot be joined via the code check", async () => {
  const game = await h.startGame(server, ["Alice", "Bob"]);
  const late = await server.connect();
  const reply = h.waitFor(late, "codeNotValid");
  late.emit("isCodeValid", { joinCode: game.roomKey });
  assert.equal(await reply, "Game in progress.");
});

test("a game in progress cannot be joined by sending joinRoom directly", async () => {
  const game = await h.startGame(server, ["Alice", "Bob"]);
  const late = await server.connect();
  late.emit("joinRoom", { ...h.profile("Mallory"), joinCode: game.roomKey });
  const joined = await h.nextEventWithin(late, "roomJoined", 500);
  assert.equal(joined, null, "late player was added to a running tournament");
});

test("leaving the lobby updates everyone's player count", async () => {
  const host = await server.connect();
  const { roomKey } = await h.createRoom(host, "Alice");
  const guest = await server.connect();
  await h.joinRoom(guest, roomKey, "Bob");
  const update = h.waitFor(host, "roomUpdate", {
    timeout: 2000,
    filter: (u) => Object.keys(u.players).length === 1,
  });
  guest.disconnect();
  const { players } = await update;
  assert.deepEqual(Object.values(players).map((p) => p.name), ["Alice"]);
});

test("only the host can start the tournament", async () => {
  const host = await server.connect();
  const { roomKey } = await h.createRoom(host, "Alice");
  const guest = await server.connect();
  await h.joinRoom(guest, roomKey, "Bob");
  guest.emit("startGame", { roomKey });
  const update = await h.nextEventWithin(host, "gameUpdate", 500);
  assert.equal(update, null, "a non-host started the game");
});

test("pressing start twice does not reset a running tournament", async () => {
  const game = await h.startGame(server, ["Alice", "Bob"]);
  await h.readyFirstBattle(game);
  game.host.emit("startGame", { roomKey: game.roomKey });
  const update = await h.nextEventWithin(game.host, "gameUpdate", 500);
  assert.equal(update, null, "the bracket was rebuilt mid-game");
});

test("round 1 pairs every player exactly once; an odd player out fights the CPU", async () => {
  const names = ["Ann", "Ben", "Dee", "Eve", "Fay"];
  const game = await h.startGame(server, names);
  const { rounds } = game.state;
  assert.equal(rounds[0].battles.length, 3);
  const text = rounds[0].battles.join(" | ");
  for (const name of names) {
    assert.equal(text.split(name).length - 1, 1, `${name} in: ${text}`);
  }
  assert.match(rounds[0].battles[2], /CPU/);
  assert.equal(rounds[rounds.length - 1].name, "Winner");
});

test("starting the game sends everyone to the first battle", async () => {
  const game = await h.startGame(server, ["Alice", "Bob", "Carol"]);
  assert.equal(game.state.currentRound, 0);
  assert.equal(game.state.currentBattle, 0);
  assert.equal(game.state.battle.player1.health, 100);
  assert.equal(game.state.battle.time, 60);
  assert.deepEqual(server.errors, []);
});
