import type { Combatant, Species } from '../types';
import { MOVES } from './moves';

/**
 * Roster de Teselia para el prólogo de Pueblo Arcilla.
 *
 * `learnset` son los movimientos que aprende por nivel: los dos primeros
 * (nivel 1) son los que conoce al nacer, capturarse o recibirse. El resto se
 * aprende al subir de nivel, con un máximo de 4 movimientos activos.
 *
 * `eggMoves` son movimientos de huevo: NO se conocen al capturar ni al recibir
 * la criatura. Quedan separados aquí para la cría / tutor de movimientos.
 *
 * Los `id` son los nombres canónicos en inglés y se usan también como nombre
 * de archivo para los sprites de la Fase 4 (public/sprites/pokemon/<id>.png).
 */
export const SPECIES: Record<string, Species> = {
  snivy: {
    id: 'snivy',
    name: 'Snivy',
    types: ['grass'],
    shape: 'serpent',
    size: 0.95,
    body: 0x4e9a5f,
    accent: 0xf2e8a0,
    base: { hp: 45, atk: 45, def: 55 },
    learnset: [
      { level: 1, move: 'placaje' },
      { level: 1, move: 'latigo_cepa' },
      { level: 6, move: 'hoja_afilada' },
      { level: 9, move: 'gigadrenado' },
      { level: 12, move: 'sintesis' },
    ],
    eggMoves: ['pulso_umbrio', 'ataque_rapido'],
  },
  tepig: {
    id: 'tepig',
    name: 'Tepig',
    types: ['fire'],
    shape: 'quad',
    size: 0.9,
    body: 0xf08a4b,
    accent: 0x2b2b2b,
    base: { hp: 65, atk: 63, def: 45 },
    learnset: [
      { level: 1, move: 'placaje' },
      { level: 1, move: 'ascuas' },
      { level: 7, move: 'rueda_fuego' },
      { level: 10, move: 'lanzallamas' },
      { level: 13, move: 'fortaleza' },
    ],
    eggMoves: ['mordisco', 'gruñido'],
  },
  oshawott: {
    id: 'oshawott',
    name: 'Oshawott',
    types: ['water'],
    shape: 'biped',
    size: 0.95,
    body: 0xe8eef5,
    accent: 0x3f7fbf,
    base: { hp: 55, atk: 55, def: 45 },
    learnset: [
      { level: 1, move: 'placaje' },
      { level: 1, move: 'pistola_agua' },
      { level: 6, move: 'burbuja' },
      { level: 9, move: 'hidrobomba' },
      { level: 12, move: 'fortaleza' },
    ],
    eggMoves: ['ataque_rapido', 'malicioso'],
  },
  patrat: {
    id: 'patrat',
    name: 'Patrat',
    types: ['normal'],
    shape: 'quad',
    size: 0.8,
    body: 0x9a7b4f,
    accent: 0xf2e3c6,
    base: { hp: 45, atk: 55, def: 39 },
    learnset: [
      { level: 1, move: 'placaje' },
      { level: 1, move: 'gruñido' },
      { level: 6, move: 'mordisco' },
      { level: 10, move: 'ataque_rapido' },
    ],
    eggMoves: ['fortaleza', 'malicioso'],
  },
  lillipup: {
    id: 'lillipup',
    name: 'Lillipup',
    types: ['normal'],
    shape: 'quad',
    size: 0.7,
    body: 0xd9c7a3,
    accent: 0x3b3b4f,
    base: { hp: 45, atk: 60, def: 45 },
    learnset: [
      { level: 1, move: 'placaje' },
      { level: 1, move: 'gruñido' },
      { level: 6, move: 'ataque_rapido' },
      { level: 10, move: 'mordisco' },
    ],
    eggMoves: ['fortaleza', 'malicioso'],
  },
  purrloin: {
    id: 'purrloin',
    name: 'Purrloin',
    types: ['dark'],
    shape: 'quad',
    size: 0.8,
    body: 0x6b4f8a,
    accent: 0xf2d98a,
    base: { hp: 41, atk: 50, def: 37 },
    learnset: [
      { level: 1, move: 'placaje' },
      { level: 1, move: 'gruñido' },
      { level: 6, move: 'mordisco' },
      { level: 10, move: 'pulso_umbrio' },
    ],
    eggMoves: ['ataque_rapido', 'malicioso'],
  },
  pidove: {
    id: 'pidove',
    name: 'Pidove',
    types: ['normal', 'flying'],
    shape: 'orb',
    size: 0.75,
    body: 0x8b8f9a,
    accent: 0x4a4f5c,
    base: { hp: 50, atk: 55, def: 50 },
    learnset: [
      { level: 1, move: 'ataque_ala' },
      { level: 1, move: 'gruñido' },
      { level: 6, move: 'ataque_rapido' },
      { level: 9, move: 'malicioso' },
    ],
    eggMoves: ['fortaleza', 'pulso_umbrio'],
  },
  roggenrola: {
    id: 'roggenrola',
    name: 'Roggenrola',
    types: ['rock'],
    shape: 'orb',
    size: 0.85,
    body: 0x5b6b8a,
    accent: 0x2f3a4f,
    base: { hp: 55, atk: 75, def: 85 },
    learnset: [
      { level: 1, move: 'placaje' },
      { level: 1, move: 'fortaleza' },
      { level: 7, move: 'lanzarrocas' },
      { level: 12, move: 'terremoto' },
    ],
    eggMoves: ['malicioso', 'mordisco'],
  },
  blitzle: {
    id: 'blitzle',
    name: 'Blitzle',
    types: ['electric'],
    shape: 'quad',
    size: 0.9,
    body: 0x2f2f3a,
    accent: 0x7fd6ff,
    base: { hp: 45, atk: 60, def: 32 },
    learnset: [
      { level: 1, move: 'placaje' },
      { level: 1, move: 'chispa' },
      { level: 6, move: 'ataque_rapido' },
      { level: 11, move: 'trueno' },
    ],
    eggMoves: ['gruñido', 'malicioso'],
  },
  boldore: {
    id: 'boldore',
    name: 'Boldore',
    types: ['rock'],
    shape: 'quad',
    size: 1.35,
    body: 0x6b7280,
    accent: 0xffc94d,
    base: { hp: 70, atk: 85, def: 90 },
    learnset: [
      { level: 1, move: 'placaje' },
      { level: 1, move: 'fortaleza' },
      { level: 6, move: 'lanzarrocas' },
      { level: 11, move: 'terremoto' },
    ],
    eggMoves: ['mordisco', 'malicioso'],
  },
};

/** Movimientos que conoce una criatura de ese nivel (máximo 4, los últimos). */
export function movesForLevel(species: Species, level: number): string[] {
  const known = species.learnset.filter((entry) => entry.level <= level).map((entry) => entry.move);
  if (known.length === 0 && species.learnset.length > 0) known.push(species.learnset[0].move);
  return known.slice(-4);
}

/** Movimientos nuevos que se aprenden exactamente en ese nivel. */
export function movesLearnedAt(species: Species, level: number): string[] {
  return species.learnset.filter((entry) => entry.level === level).map((entry) => entry.move);
}

/** Movimientos de huevo: no forman parte del learnset normal. */
export function eggMovesOf(speciesId: string): string[] {
  return SPECIES[speciesId]?.eggMoves ?? [];
}

export function createCombatant(speciesId: string, level: number): Combatant {
  const species = SPECIES[speciesId];
  if (!species) throw new Error(`Especie desconocida: ${speciesId}`);
  const combatant: Combatant = {
    species,
    level,
    hp: 0,
    xp: 0,
    moves: movesForLevel(species, level),
  };
  combatant.hp = maxHpOf(combatant);
  return combatant;
}

/**
 * Vida estilo PBA (barras largas de combate en tiempo real), no la fórmula
 * por turnos de la saga principal: vida base * 1.6 + nivel * 3.5.
 */
export function maxHpOf(c: Combatant): number {
  return Math.floor(c.species.base.hp * 1.6 + c.level * 3.5);
}

export function attackOf(c: Combatant): number {
  return c.species.base.atk + c.level * 1.6;
}

export function defenseOf(c: Combatant): number {
  return c.species.base.def + c.level * 1.4;
}

export function xpToNext(c: Combatant): number {
  return 40 + c.level * 25;
}

export function computeDamage(
  attacker: Combatant,
  defender: Combatant,
  moveId: string,
  typeMult: number,
  attackScale = 1,
  defenseScale = 1,
): number {
  const move = MOVES[moveId];
  if (!move || move.category === 'status') return 0;
  const atk = attackOf(attacker) * attackScale;
  const def = defenseOf(defender) * defenseScale;
  const ratio = atk / (atk + def);
  const variance = 0.9 + Math.random() * 0.2;
  return Math.max(1, Math.round(move.power * ratio * 1.15 * typeMult * variance));
}

export function leadOf(party: Combatant[]): Combatant {
  const alive = party.find((c) => c.hp > 0);
  return alive ?? party[0];
}
