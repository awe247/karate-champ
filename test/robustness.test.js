// Runs the real server (node server) as a separate process and sends it the
// kind of messages a stale browser tab or a typo can produce. One bad message
// must never take the server down: every game on it would end.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const { spawn } = require("child_process");
const { io: ioClient } = require("socket.io-client");
const { waitFor, sleep } = require("./helpers");

async function startRealServer() {
  const port = 20000 + Math.floor(Math.random() * 20000);
  const child = spawn(process.execPath, [path.join(__dirname, "..", "server")], {
    env: { ...process.env, PORT: String(port) },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let output = "";
  child.stdout.on("data", (d) => (output += d));
  child.stderr.on("data", (d) => (output += d));
  for (let i = 0; i < 100 && !output.includes("Mixing it up"); i++) await sleep(50);
  assert.ok(output.includes("Mixing it up"), `server did not start:\n${output}`);
  return { child, url: `http://localhost:${port}`, output: () => output };
}

async function connect(url) {
  const socket = ioClient(url, { transports: ["websocket"], forceNew: true, reconnection: false });
  await waitFor(socket, "connect");
  return socket;
}

const badMessages = [
  ["joinRoom", { playerName: "X", joinCode: "NOPE1" }],
  ["startGame", { roomKey: "NOPE1" }],
  ["sendReady", { roomKey: "NOPE1", currentRound: 0, currentBattle: 0 }],
  ["sendNext", { roomKey: "NOPE1", currentRound: 0, currentBattle: 0 }],
  ["sendMoves", { roomKey: "NOPE1", attack: 1, defend: 1 }],
  ["needUpdate", { roomKey: "NOPE1" }],
];

for (const [event, args] of badMessages) {
  test(`"${event}" for a room that does not exist leaves the server running`, async () => {
    const server = await startRealServer();
    try {
      const socket = await connect(server.url);
      socket.emit(event, args);
      await sleep(500);
      socket.disconnect();
      assert.equal(server.child.exitCode, null, `server crashed:\n${server.output().slice(-600)}`);
      const again = await connect(server.url);
      again.disconnect();
    } finally {
      server.child.kill();
    }
  });
}
