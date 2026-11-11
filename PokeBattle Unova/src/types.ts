export type ElementType =
  | 'normal'
  | 'fire'
  | 'water'
  | 'grass'
  | 'electric'
  | 'rock'
  | 'dark'
  | 'flying';

export type CreatureShape = 'biped' | 'quad' | 'serpent' | 'orb';

export type MoveCategory = 'physical' | 'special' | 'status';
export type MoveRange = 'short' | 'medium' | 'long';
export type MoveEffect = 'drain' | 'slow' | 'attack_down' | 'defense_up' | 'heal';

export interface MoveDef {
  id: string;
  name: string;
  type: ElementType;
  /** physical = contacto/proyectil físico, special = energía, status = sin daño */
  category: MoveCategory;
  /** alcance en la arena: corto, medio o largo */
  range: MoveRange;
  power: number;
  /** segundos de recarga */
  cooldown: number;
  /** energía consumida */
  energy: number;
  /** unidades por segundo del proyectil */
  speed: number;
  color: number;
  radius: number;
  desc: string;
  /** efecto adicional (sólo uno por movimiento en esta demo) */
  effect?: MoveEffect;
  effectValue?: number;
}

export interface Species {
  id: string;
  name: string;
  types: ElementType[];
  shape: CreatureShape;
  size: number;
  body: number;
  accent: number;
  base: { hp: number; atk: number; def: number };
  /** Movimientos que aprende al subir de nivel (los dos primeros, al nacer) */
  learnset: { level: number; move: string }[];
  /** Movimientos heredados por huevo: no se conocen al capturar/recibir */
  eggMoves: string[];
}

export interface Combatant {
  species: Species;
  level: number;
  hp: number;
  xp: number;
  /** Movimientos conocidos ahora mismo (máximo 4) */
  moves: string[];
}

export interface TrainerTeamEntry {
  speciesId: string;
  level: number;
}

export interface BattleRequest {
  kind: 'wild' | 'trainer';
  trainerName?: string;
  team: TrainerTeamEntry[];
  canCatch: boolean;
}

export type BattleOutcome = 'win' | 'lose' | 'caught' | 'flee';
