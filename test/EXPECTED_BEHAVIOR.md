# Expected behaviour

The rules the test suite checks. Most come from what the code is already trying
to do. The ones marked *(decided)* weren't settled in the code, so I picked a
reasonable behaviour.

Run the suite with `npm test`. It takes about 90 seconds because battles run in
real time: there's a 2s countdown before the first battle and 1s per strike. The
60-second battle clock is fast-forwarded.

## Lobby
- **Host** creates a room with a 5-character code (A–Z without I/O, plus 0–9). The host is player 1.
- **Joining** checks the code first, then joins with the player's own name and colours. Everyone already in the room gets a `roomUpdate`.
- Codes are **case-insensitive**. *(decided: people type them on phones)*
- Nobody can join a game that has **already started**, through the code check *or* a direct `joinRoom`.
- A room holds at most 32 players.
- When someone **leaves the lobby**, everyone's player count updates.
- **Only the host** can start, and only once. Pressing start again does nothing. *(decided: the UI only shows the host a start button)*

## Bracket
- Round 1 pairs every player exactly once. With an odd number, the last player fights the **CPU**.
- Each round's winners are paired in the order they won. An odd winner out fights the CPU.
- The tournament ends when a round has a single battle. The winner of that battle is the champion and is shown under "Winner".

## Battle
- A battle starts when one of its fighters says READY. Two seconds later everyone gets `ready` and the 60-second clock starts. READY from someone else is ignored.
- Each exchange: both fighters pick an attack (high/mid/low) and a defence (high/mid/low).
  - The player who **submits first strikes first**. If that strike knocks the opponent out, the opponent's strike doesn't happen.
  - Damage is **60**, or **30** when the defence matches the attack. Health starts at 100.
- A second submission in the same exchange is ignored.
- Moves sent **before the battle starts** or **after a KO** are ignored. A finished result can never change.
- `checkMovesSent` returns true once a player's move for the current exchange is in.
- **Time up:** the player with **more health wins**. *(decided: currently player 1 always wins)*
- **CPU battles:** the player strikes, then the CPU strikes back. The CPU always has health (100 at the start) in every round. Mashing the buttons plays one exchange at a time.
- **If the CPU wins**, it advances like a player. A human who meets it later gets a normal, playable CPU battle.

## Moving between battles
- After a battle, the next one starts once **every connected player** has pressed READY.
- A repeated or out-of-date READY for an earlier battle must **never** skip the battle in progress.
- After the final battle, READY shows the results screen with the champion.

## Dropped players
*(decided: the game must never freeze because someone's phone locked or a tab closed)*
- If a player who isn't fighting disconnects, nobody waits for them any more.
- If the last player everyone was waiting on leaves, the game moves on.
- If a fighter disconnects mid-battle, their opponent **wins by forfeit**.
- A player whose tab was in the background can ask for the current state (`needUpdate`) and get it.

## Server robustness
- No message, including one for a room that doesn't exist, may crash the server. One crash ends every game running on it.
