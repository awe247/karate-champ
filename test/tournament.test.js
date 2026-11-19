// Whole-tournament flow: advancing between battles and rounds, and coping
// with players who drop out (phones locking, tabs closing, bad wifi).
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const h = require("./helpers");

let server;
before(async () => (server = await h.startServer()));
after(() => server.close());

async function playWholeTournament(names) {
  const game = await h.startGame(server, names);
  await h.readyFirstBattle(game);
  await h.withRandom(0, async () => {
    for (let i = 0; i < names.length + 2; i++) {
      await h.playCurrentBattle(game);
      const { type, payload } = await h.everyoneNext(game);
      if (type === "gameOver") {
        game.result = payload;
        return;
      }
    }
    throw new Error("Tournament never finished");
  });
  return game;
}

test("a 4-player tournament runs to a champion", async () => {
  const game = await playWholeTournament(["A", "B", "C", "D"]);
  const champion = game.result.rounds.at(-1).battles[0];
  assert.ok(["A", "B", "C", "D"].includes(champion), `champion was "${champion}"`);
  assert.deepEqual(server.errors, []);
});

test("a 3-player tournament (one CPU bye) runs to a champion", async () => {
  const game = await playWholeTournament(["A", "B", "C"]);
  assert.ok(["A", "B", "C"].includes(game.result.rounds.at(-1).battles[0]));
});

test("a 6-player tournament runs to a champion", async () => {
  const game = await playWholeTournament(["A", "B", "C", "D", "E", "F"]);
  assert.ok(["A", "B", "C", "D", "E", "F"].includes(game.result.rounds.at(-1).battles[0]));
});

test("the next battle waits until every player has pressed READY", async () => {
  const game = await h.startGame(server, ["A", "B", "C", "D"]);
  await h.readyFirstBattle(game);
  await h.playCurrentBattle(game);
  const [first, ...rest] = game.connected();
  const args = { roomKey: game.roomKey, currentRound: 0, currentBattle: 0 };
  rest.forEach((s) => s.emit("sendNext", args));
  assert.equal(await h.nextEventWithin(game.host, "next", 800), null);
  const next = h.waitFor(game.host, "next");
  first.emit("sendNext", args);
  assert.equal((await next).currentBattle, 1);
});

test("a repeated or stale READY never skips the battle in progress", async () => {
  const game = await h.startGame(server, ["A", "B", "C", "D"]);
  await h.readyFirstBattle(game);
  await h.playCurrentBattle(game);
  await h.everyoneNext(game); // now on round 1, battle 2
  assert.equal(game.state.currentBattle, 1);

  // A slow phone re-sends READY for the battle that already finished.
  game.host.emit("sendNext", { roomKey: game.roomKey, currentRound: 0, currentBattle: 0 });
  const skipped = await h.nextEventWithin(game.host, "next", 1000);
  assert.equal(skipped, null, `game jumped to ${JSON.stringify(skipped && { r: skipped.currentRound, b: skipped.currentBattle })}`);
});

test("a spectator dropping out does not freeze the tournament", async () => {
  const game = await h.startGame(server, ["A", "B", "C", "D"]);
  await h.readyFirstBattle(game);
  await h.playCurrentBattle(game);
  // Someone not in the battle that just finished closes their tab.
  const { battle } = game.state;
  const leaver = game.players.find(
    (p) => p.socket.id !== battle.player1.id && p.socket.id !== battle.player2.id
  ).socket;
  leaver.disconnect();
  await h.sleep(300);
  const { type } = await h.everyoneNext(game);
  assert.equal(type, "next");
});

test("a player who leaves while everyone else is on the result screen does not freeze it", async () => {
  const game = await h.startGame(server, ["A", "B", "C", "D"]);
  await h.readyFirstBattle(game);
  await h.playCurrentBattle(game);
  const [stays, ...others] = game.connected();
  const leaver = others.pop();
  const args = { roomKey: game.roomKey, currentRound: 0, currentBattle: 0 };
  [stays, ...others].forEach((s) => s.emit("sendNext", args));
  await h.sleep(300);
  const next = h.waitFor(game.host, "next", { timeout: 3000 });
  leaver.disconnect(); // the last person everyone was waiting on leaves
  await next;
});

test("a fighter who disconnects mid-battle forfeits to their opponent", async () => {
  const game = await h.startGame(server, ["Alice", "Bob", "Carol"]);
  await h.readyFirstBattle(game);
  const { p1, p2 } = game.fighters();
  const observer = game.players.find((p) => p.socket !== p1 && p.socket !== p2).socket;
  const result = h.waitFor(observer, "battleUpdate", {
    timeout: 3000,
    filter: (u) => !!u.battle?.winner,
  });
  p2.disconnect();
  const { battle } = await result;
  assert.ok(battle.winner.startsWith(game.state.battle.player1.name), battle.winner);
});

test("a player who reloads mid-tournament gets the current state back", async () => {
  const game = await h.startGame(server, ["Alice", "Bob"]);
  await h.readyFirstBattle(game);
  const update = h.waitFor(game.host, "gameUpdate");
  game.host.emit("needUpdate", { roomKey: game.roomKey });
  const state = await update;
  assert.equal(state.currentRound, 0);
  assert.equal(state.battle.ready, true);
  assert.equal(state.waiting, false);
});
