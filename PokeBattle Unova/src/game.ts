import { createCombatant, maxHpOf, movesLearnedAt, xpToNext } from './data/species';
import { MAPS, START_MAP } from './world/maps';
import type { Combatant } from './types';

const SAVE_KEY = 'pokemaster-battle-unova:save-v1';

interface SavedCombatant {
  speciesId: string;
  level: number;
  hp: number;
  xp: number;
}

export interface SaveData {
  version: 1;
  map: string;
  x: number;
  y: number;
  facing: number;
  party: SavedCombatant[];
  flags: string[];
  objective: string;
  savedAt: number;
}

export class GameState {
  party: Combatant[] = [];
  flags = new Set<string>();
  objectiveText = '';
  map = START_MAP;
  x = MAPS[START_MAP].spawn.x;
  y = MAPS[START_MAP].spawn.y;
  facing = Math.PI;
  playerName = 'Tú';
  /** Movimientos aprendidos en el último combate (para avisar en el HUD) */
  lastLearned: string[] = [];

  get hasStarter(): boolean {
    return this.party.length > 0;
  }

  /** Primera criatura con vida (o la primera del equipo si todas cayeron). */
  lead(): Combatant | null {
    if (this.party.length === 0) return null;
    return this.party.find((c) => c.hp > 0) ?? this.party[0];
  }

  give(speciesId: string, level: number): Combatant | null {
    if (this.party.length >= 6) return null;
    const combatant = createCombatant(speciesId, level);
    this.party.push(combatant);
    return combatant;
  }

  heal(): void {
    for (const c of this.party) {
      c.hp = maxHpOf(c);
    }
  }

  /** Devuelve los niveles subidos. */
  awardXp(combatant: Combatant, amount: number): number {
    combatant.xp += amount;
    let levels = 0;
    this.lastLearned = [];
    while (combatant.level < 60 && combatant.xp >= xpToNext(combatant)) {
      combatant.xp -= xpToNext(combatant);
      combatant.level += 1;
      combatant.hp = maxHpOf(combatant);
      levels += 1;
      for (const moveId of movesLearnedAt(combatant.species, combatant.level)) {
        if (combatant.moves.includes(moveId)) continue;
        if (combatant.moves.length < 4) combatant.moves.push(moveId);
        else {
          // Con 4 movimientos, el nuevo sustituye al más antiguo.
          combatant.moves.shift();
          combatant.moves.push(moveId);
        }
        this.lastLearned.push(moveId);
      }
    }
    return levels;
  }

  reset(): void {
    this.party = [];
    this.lastLearned = [];
    this.flags = new Set();
    this.objectiveText = 'Abre el paquete de la Profesora Encina';
    this.map = START_MAP;
    this.x = MAPS[START_MAP].spawn.x;
    this.y = MAPS[START_MAP].spawn.y;
    this.facing = Math.PI;
  }

  save(): void {
    const data: SaveData = {
      version: 1,
      map: this.map,
      x: this.x,
      y: this.y,
      facing: this.facing,
      party: this.party.map((c) => ({
        speciesId: c.species.id,
        level: c.level,
        hp: c.hp,
        xp: c.xp,
      })),
      flags: [...this.flags],
      objective: this.objectiveText,
      savedAt: Date.now(),
    };
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    } catch {
      /* almacenamiento lleno o bloqueado: seguimos jugando sin guardar */
    }
  }

  load(): boolean {
    const raw = readSave();
    if (!raw) return false;

    this.map = MAPS[raw.map] ? raw.map : START_MAP;
    this.x = raw.x;
    this.y = raw.y;
    this.facing = raw.facing;
    this.flags = new Set(raw.flags);
    this.objectiveText = raw.objective;
    this.party = [];
    for (const saved of raw.party) {
      try {
        const combatant = createCombatant(saved.speciesId, saved.level);
        combatant.hp = Math.max(1, Math.min(maxHpOf(combatant), saved.hp));
        combatant.xp = saved.xp;
        this.party.push(combatant);
      } catch {
        /* especie retirada del roster: se ignora */
      }
    }
    return true;
  }
}

export function readSave(): SaveData | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as SaveData;
    if (!data || data.version !== 1 || !Array.isArray(data.party)) return null;
    return data;
  } catch {
    return null;
  }
}

export function clearSave(): void {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch {
    /* nada que hacer */
  }
}
