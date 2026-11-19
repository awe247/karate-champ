# Karate Champ

A browser party game: a knockout karate tournament for a room full of people on their phones and laptops. One person hosts, everyone else joins with a 5-character code. You're paired off for one-on-one fights while everyone else watches each bout live, until one champion is left.

Built with [Phaser 3](https://phaser.io/), React, and Socket.IO on a small Express server.

## How to play

### Set up
1. Open the game and pick a **name** and the **colours** for your fighter's hair, skin, eyes and gi.
2. One person presses **Host**. A room code appears on their screen.
3. Everyone else types the code (upper or lower case is fine) and presses **Join**. The player count goes up as people arrive.
4. Once everyone is in, the host presses **READY** to start. Up to 32 players can join a room.

### The tournament
- Players are paired off for round 1. With an odd number, one player fights the **CPU**.
- Battles happen one at a time and everyone watches each one.
- Winners move on to the next round. An odd winner out fights the CPU again.
- After each battle, everyone presses **READY** to move on to the next one.
- The last player standing is crowned champion on the results screen.

### Fighting
Each fighter starts with **100 health**, and each battle has a **60-second clock**.

Every exchange, both fighters secretly choose two things in their thought bubble:
1. **Attack** (fist icon): high, mid or low.
2. **Defence** (shield icon): high, mid or low.

Then both attacks play out:
- **Whoever submits first strikes first.** If that strike is a knockout, the other player doesn't get to hit back. Speed matters.
- A hit does **60 damage**. If the defender guarded the same height, it's blocked and does **30**.
- Two clean hits are a knockout.
- If time runs out, the fighter with **more health wins**. A tie goes to the fighter on the left.

Against the CPU you always strike first, then the CPU answers. Its choices are random.

### If someone drops out
Phones lock and wifi drops, so the game is built to keep going:
- If a fighter disconnects mid-battle, their opponent **wins by forfeit**.
- If a player who isn't fighting leaves, nobody waits for them on the READY screen.
- If the host leaves the lobby before starting, another player becomes host and gets the start button.
- If your tab was in the background, the game catches up with the current battle when you come back.

**Known limitation:** a player who disconnects can't rejoin their game yet. Reconnecting gives them a new identity, so they're out of the tournament. Ask everyone to keep their screens awake.

## Running it

You need Node.js 22 or newer.

```bash
npm install
```

### Development
```bash
npm run start-dev
```
This opens two windows: webpack rebuilding the client on change, and the server restarting on change (via nodemon). The `start` command it uses only works on Windows. Elsewhere, run `npm run start-dev:client` and `npm run start-dev:server` in two terminals.

Then open http://localhost:8080. To try multiplayer on your own, open several browser tabs.

### Production
```bash
npm run build-client
npm start
```
The server listens on `PORT` (default 8080) and serves the built client from `public/`. The client connects back to whichever host served the page, so no endpoint needs configuring. It runs anywhere that runs Node and supports WebSockets.

To let other people on your network play a locally running server, have them open `http://<your-computer's-IP>:8080`.

## Tests

```bash
npm test
```

The suite uses Node's built-in test runner and takes about 90 seconds. Battles run in real time: a 2-second countdown and 1 second per strike. The 60-second clock is fast-forwarded. Tests drive the real Socket.IO server with real socket.io clients, the same way browsers do. They cover:

| File | What it checks |
| --- | --- |
| `test/lobby.test.js` | Hosting, joining, room codes, who can start, the round 1 bracket |
| `test/battle.test.js` | Ready/countdown, damage and blocking, strike order, ignored moves, time-up |
| `test/cpu.test.js` | CPU battles in every round, including when the CPU wins |
| `test/tournament.test.js` | Whole tournaments for 3, 4 and 6 players; READY flow; disconnects and forfeits |
| `test/robustness.test.js` | Runs the real server process and checks that bad messages can't crash it |

The full set of rules the tests enforce is in [`test/EXPECTED_BEHAVIOR.md`](test/EXPECTED_BEHAVIOR.md). If you change a rule, update that file and the matching test.

Lint with `npm run lint`.

## Project layout

```
server/
  index.js          Express app: serves public/, starts Socket.IO
  socket/index.js   All game logic: rooms, bracket, battles, clock, disconnects
src/
  index.tsx, App.tsx      React shell and the join/host form
  socket.ts               Socket.IO client connection
  components/             Phaser game wrapper, fighter preview SVG
  scenes/Main.ts          Title screen and lobby (room code, player count)
  scenes/Fight.ts         The battle screen: fighters, health bars, thought-bubble controls
  scenes/Matchups.ts      Final bracket/results screen
  game/                   Shared types and helpers (sprite recolouring)
public/             Static assets (sprites, audio) and the built bundle
test/               Test suite and EXPECTED_BEHAVIOR.md
```

### How a game flows (Socket.IO events)
The server decides everything. Clients send intentions and draw what the server tells them.

| Client → server | Server → clients |
| --- | --- |
| `createGame`, `isCodeValid`, `joinRoom` | `roomCreated`, `codeIsValid` / `codeNotValid`, `roomJoined`, `roomUpdate`, `becameHost` |
| `startGame` (host only) | `gameUpdate` (first battle and bracket) |
| `sendReady` (a fighter's screen has loaded) | `ready` after 2s, then `timeUpdate` each second |
| `sendMoves` `{ attack, defend }` (1 high, 2 mid, 3 low) | `moveUpdate` (hide that fighter's controls), `battleUpdate` per strike or result |
| `sendNext` (READY after a battle) | `next` once everyone is ready, or `gameOver` after the final |
| `needUpdate`, `checkMovesSent`, `checkInputStatus` | `gameUpdate` / acknowledgement callbacks, used to resync a tab that was in the background |

Game state lives in memory on the server. Restarting the server ends any games in progress.
