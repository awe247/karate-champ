// CPU opponents. Math.random is pinned to 0 so the CPU always attacks and
// defends HIGH (1), which makes every exchange deterministic.
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const h = require("./helpers");

let server;
before(async () => (server = await h.startServer()));
after(() => server.close());

const HIGH = 1;
const MID = 2;

test("a lone player fights the CPU: player strikes, then the CPU answers", async () => {
  const game = await h.startGame(server, ["Alice"]);
  assert.equal(game.state.battle.player2, undefined);
  assert.equal(game.state.battle.cpuHealth, 100);
  await h.readyFirstBattle(game);
  await h.withRandom(0, async () => {
    const alice = game.host;
    const [hit, answer] = await h.exchange(game, alice, { attack: MID, defend: HIGH });
    assert.equal(hit.sequence.playerId, alice.id);
    assert.equal(hit.battle.cpuHealth, 40);
    assert.equal(answer.sequence.playerId, "cpu");
    assert.equal(answer.battle.player1.health, 70, "CPU's HIGH attack was blocked");
  });
});

test("beating the CPU in the final makes you champion", async () => {
  const game = await h.startGame(server, ["Alice"]);
  await h.readyFirstBattle(game);
  await h.withRandom(0, () => h.beatCpu(game, game.host));
  const { type, payload } = await h.everyoneNext(game);
  assert.equal(type, "gameOver");
  assert.deepEqual(payload.rounds.at(-1).battles, ["Alice"]);
});

test("mashing the buttons against the CPU only plays one exchange at a time", async () => {
  const game = await h.startGame(server, ["Alice"]);
  await h.readyFirstBattle(game);
  await h.withRandom(0, async () => {
    const done = h.collectBattleUpdates(game.host, 2);
    for (let i = 0; i < 3; i++) {
      game.host.emit("sendMoves", { roomKey: game.roomKey, attack: MID, defend: HIGH });
    }
    await done;
    await h.sleep(2500);
    const { battle } = await new Promise((resolve) => {
      game.host.once("gameUpdate", resolve);
      game.host.emit("needUpdate", { roomKey: game.roomKey });
    });
    assert.equal(battle.cpuHealth, 40, "three rapid submissions were all resolved");
    assert.equal(battle.winner, undefined);
  });
});

test("if the CPU knocks a player out, the next round is still playable", async () => {
  // 3 players: round 1 = [X vs Y], [Z vs CPU]. Z loses to the CPU.
  const game = await h.startGame(server, ["Alice", "Bob", "Carol"]);
  await h.readyFirstBattle(game);
  await h.playCurrentBattle(game);
  const advanced = await h.everyoneNext(game);
  assert.equal(advanced.type, "next");
  assert.equal(game.state.battle.player2, undefined, "second battle is the CPU one");

  const z = game.fighters().p1;
  await h.withRandom(0, async () => {
    // Z attacks HIGH (blocked by CPU) and defends MID (CPU's HIGH lands).
    for (let i = 0; i < 4; i++) {
      const ups = await h.exchange(game, z, { attack: HIGH, defend: MID });
      if (ups.at(-1).battle.winner) break;
    }
  });
  const final = await h.everyoneNext(game);
  assert.equal(final.type, "next", "tournament should continue to round 2");

  // Round 2: the round-1 winner has to be able to finish the tournament.
  const { battle } = game.state;
  const human = game.byId(battle.player1.id) ?? game.byId(battle.player2?.id);
  assert.ok(human, "no connected player is in the round 2 battle");
  const response = h.waitFor(game.host, "battleUpdate", { timeout: 4000 });
  await h.withRandom(0, async () => {
    human.emit("sendMoves", { roomKey: game.roomKey, attack: MID, defend: HIGH });
    await response;
  });
});

test("a CPU opponent in a later round has health and can be beaten", async () => {
  // 5 players: round 1 = 3 battles, so round 2 = [w1 vs w2], [w3 vs CPU].
  const game = await h.startGame(server, ["A", "B", "C", "D", "E"]);
  await h.readyFirstBattle(game);
  await h.withRandom(0, async () => {
    for (let i = 0; i < 4; i++) {
      await h.playCurrentBattle(game);
      await h.everyoneNext(game);
    }
    // Now at round 2, battle 2 (w3 vs CPU).
    assert.equal(game.state.currentRound, 1);
    assert.equal(game.state.battle.player2, undefined);
    assert.equal(game.state.battle.cpuHealth, 100);
    await h.playCurrentBattle(game);
  });
  assert.deepEqual(server.errors, []);
});
