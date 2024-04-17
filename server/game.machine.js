const { createMachine } = require("xstate");

const gameMachine = createMachine({
  id: "gameMachined",
  initial: "initializing",
  context: {
    gameRooms: {
      // [roomKey]: {
      //  players: PlayerMap,
      //  numPlayers: 0
      //  started: false,
      //  rounds: Round[]
      // }
    },
  },
  states: {
    initializing: {},
    ready: {},
  },
});

let currentState = lightMachine.initialState;

function sendEvent(event, ...args) {
  currentState = lightMachine.transition(currentState, event, ...args);
  console.log("Current state:", currentState.value);
}

function getContext() {
  return currentState.context;
}

module.exports = { gameMachine, sendEvent, getContext };
