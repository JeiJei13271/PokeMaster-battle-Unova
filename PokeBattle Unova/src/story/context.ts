import type { BattleOutcome, BattleRequest, Combatant } from '../types';

/**
 * Todo lo que un diálogo puede hacer. El guion (src/story/script.ts) sólo
 * habla con esta interfaz, así que puedes cambiar mapas, motor de combate o
 * interfaz sin tocar la historia.
 */
export interface StoryCtx {
  readonly playerName: string;

  /** Línea de diálogo con retrato/nombre. Se resuelve al pulsar E. */
  say(name: string, text: string): Promise<void>;
  /** Línea sin nombre (narrador). */
  narrate(text: string): Promise<void>;
  /** Menú de opciones; devuelve el índice elegido. */
  choice(options: string[]): Promise<number>;

  /** Abre un combate en tiempo real y espera el resultado. */
  battle(request: BattleRequest): Promise<BattleOutcome>;

  hasFlag(flag: string): boolean;
  setFlag(flag: string): void;

  objective(text: string): void;
  toast(text: string): void;

  /** Añade una criatura al equipo (silencioso si ya hay 6). */
  give(speciesId: string, level: number): void;
  party(): Combatant[];
  heal(): void;
  /** id de especie de la primera criatura del equipo, o null. */
  starterId(): string | null;

  /** Marca el final del contenido de la demo. */
  endDemo(): void;
}
