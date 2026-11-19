const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const h = require("./helpers");

let server;
before(async () => (server = await h.startServer()));
after(() => server.close());

const HIGH = 1;
const MID = 2;

async function twoPlayerBattle() {
  const game = await h.startGame(server, ["Alice", "Bob"]);
  await h.readyFirstBattle(game);
  return { game, ...game.fighters() };
}

test("a fighter's READY starts the battle for everyone and the clock ticks down", async () => {
  const game = await h.startGame(server, ["Alice", "Bob"]);
  const others = game.players.map((p) => h.waitFor(p.socket, "ready", { timeout: 4000 }));
  await h.readyFirstBattle(game);
  await Promise.all(others);
  const tick = await h.waitFor(game.host, "timeUpdate", { timeout: 2000 });
  assert.equal(tick.time, 59);
});

test("READY from someone who is not in the battle does not start it", async () => {
  const game = await h.startGame(server, ["Alice", "Bob", "Carol"]);
  const { battle } = game.state;
  const spectator = game.players.find(
    (p) => p.socket.id !== battle.player1.id && p.socket.id !== battle.player2?.id
  ).socket;
  spectator.emit("sendReady", { roomKey: game.roomKey, currentRound: 0, currentBattle: 0 });
  assert.equal(await h.nextEventWithin(game.host, "ready", 2500), null);
});

test("an exchange resolves both attacks; the faster player strikes first", async () => {
  const { game, p1, p2 } = await twoPlayerBattle();
  const [first, second] = await h.exchange(
    game,
    p2, { attack: HIGH, defend: HIGH },
    p1, { attack: MID, defend: MID }
  );
  assert.equal(first.sequence.playerId, p2.id);
  assert.equal(first.battle.player1.health, 40, "unblocked hit = 60 damage");
  assert.equal(second.sequence.playerId, p1.id);
  assert.equal(second.battle.player2.health, 40);
});

test("a matching defence blocks and halves the damage", async () => {
  const { game, p1, p2 } = await twoPlayerBattle();
  const [, second] = await h.exchange(
    game,
    p1, { attack: HIGH, defend: MID },
    p2, { attack: MID, defend: HIGH }
  );
  assert.equal(second.battle.player1.health, 70);
  assert.equal(second.battle.player2.health, 70);
});

test("two KO hits end the battle and name the winner", async () => {
  const { game, p1, p2 } = await twoPlayerBattle();
  const last = await h.playToKO(game, p2, p1);
  const { player1, player2 } = game.state.battle;
  assert.equal(last.battle.winner, `${player2.name} def. ${player1.name}`);
  assert.ok(last.battle.player1.health <= 0);
  assert.deepEqual(server.errors, []);
});

test("submitting twice in one exchange only counts once", async () => {
  const { game, p1, p2 } = await twoPlayerBattle();
  p1.emit("sendMoves", { roomKey: game.roomKey, attack: HIGH, defend: HIGH });
  const updates = await h.exchange(
    game,
    p1, { attack: HIGH, defend: HIGH },
    p2, { attack: MID, defend: MID }
  );
  assert.equal(updates.length, 2);
  assert.equal(updates[1].battle.player1.health, 40);
  assert.equal(updates[1].battle.player2.health, 40);
  assert.equal(await h.nextEventWithin(game.host, "battleUpdate", 1500), null);
});

test("the server reports that a player's move is in (checkMovesSent)", async () => {
  const { game, p1, p2 } = await twoPlayerBattle();
  p1.emit("sendMoves", { roomKey: game.roomKey, attack: HIGH, defend: HIGH });
  await h.sleep(100);
  assert.equal(await h.emitWithAck(p1, "checkMovesSent", { roomKey: game.roomKey }), true);
  assert.equal(await h.emitWithAck(p2, "checkMovesSent", { roomKey: game.roomKey }), false);
});

test("input controls are only offered to the player who still has to move", async () => {
  const { game, p1, p2 } = await twoPlayerBattle();
  const before1 = await h.emitWithAck(p1, "checkInputStatus", { roomKey: game.roomKey });
  assert.deepEqual(before1, { showP1: true, showP2: true, showInputsP1: true, showInputsP2: false });
  p1.emit("sendMoves", { roomKey: game.roomKey, attack: HIGH, defend: HIGH });
  await h.sleep(100);
  const after2 = await h.emitWithAck(p2, "checkInputStatus", { roomKey: game.roomKey });
  assert.deepEqual(after2, { showP1: false, showP2: true, showInputsP1: false, showInputsP2: true });
});

test("moves sent before the battle has started are ignored", async () => {
  const game = await h.startGame(server, ["Alice", "Bob"]);
  const { p1, p2 } = game.fighters();
  p1.emit("sendMoves", { roomKey: game.roomKey, attack: HIGH, defend: HIGH });
  p2.emit("sendMoves", { roomKey: game.roomKey, attack: MID, defend: MID });
  assert.equal(await h.nextEventWithin(game.host, "battleUpdate", 2500), null);
});

test("moves sent after a KO are ignored and cannot change the result", async () => {
  const { game, p1, p2 } = await twoPlayerBattle();
  await h.playToKO(game, p1, p2); // p1 (player1) wins
  const late = h.nextEventWithin(game.host, "battleUpdate", 2500);
  p2.emit("sendMoves", { roomKey: game.roomKey, attack: HIGH, defend: HIGH });
  await h.sleep(50);
  p1.emit("sendMoves", { roomKey: game.roomKey, attack: MID, defend: MID });
  assert.equal(await late, null, "the fight continued after the KO");
});

test("after the final KO, READY shows the tournament result with the champion", async () => {
  const { game, p1, p2 } = await twoPlayerBattle();
  await h.playToKO(game, p2, p1);
  const { type, payload } = await h.everyoneNext(game);
  assert.equal(type, "gameOver");
  const winnerRound = payload.rounds[payload.rounds.length - 1];
  assert.deepEqual(winnerRound, { name: "Winner", battles: [game.state.battle.player2.name] });
});

test("when time runs out, the player with more health wins", async (t) => {
  const game = await h.startGame(server, ["Alice", "Bob"]);
  t.mock.timers.enable({ apis: ["setInterval"] }); // fast-forward the 60s clock only
  await h.readyFirstBattle(game);
  const { p1, p2 } = game.fighters();
  // player2 blocks, player1 does not: player1 100 -> 40, player2 100 -> 70.
  await h.exchange(game, p1, { attack: HIGH, defend: HIGH }, p2, { attack: MID, defend: HIGH });

  const timeUp = h.waitFor(game.host, "battleUpdate", { timeout: 2000 });
  t.mock.timers.tick(61_000);
  const { battle } = await timeUp;
  t.mock.timers.reset();

  const p2Name = game.state.battle.player2.name;
  assert.ok(battle.winner.startsWith(p2Name), `winner was "${battle.winner}" but ${p2Name} had more health`);
});
