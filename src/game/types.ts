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

export interface Battle {
  player1: PlayerBattle;
  player2?: PlayerBattle;
  time: number;
}
