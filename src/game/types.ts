export interface Player {
  id: string;
  name: string;
  hairColor: string;
  skinColor: string;
  eyeColor: string;
  giColor: string;
}

export interface PlayerMap {
  [id: string]: Player;
}

export interface RoundResult {
  name: string;
  battles: string[];
}

export interface PlayerBattle extends Player {
  health: number;
}

export enum PlayerFrame {
  "LowMiss" = 4,
  "MidBlock" = 5,
  "HighBlock" = 6,
  "LowPunch" = 7,
  "MidKick" = 8,
  "HighKick" = 9,
  "HighHit" = 10,
  "MidHit" = 11,
  "KO" = 12,
}

export enum BattleAttack {
  "None" = 0,
  "High" = 1,
  "Mid" = 2,
  "Low" = 3,
}

export enum BattleDefend {
  "None" = 0,
  "High" = 1,
  "Mid" = 2,
  "Low" = 3,
}

export interface BattleSequence {
  playerId: string;
  attack: BattleAttack;
  opponentResponse: BattleDefend;
}

export interface Battle {
  player1: PlayerBattle;
  player2?: PlayerBattle;
  moves: BattleSequence[];
  time: number;
  cpuHealth: number;
  winner: string;
  ready: boolean;
}
