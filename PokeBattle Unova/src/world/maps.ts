export type TileChar = '.' | ',' | 'g' | 'f' | 'T' | '#' | 'W' | '=' | 's' | 'r' | 'w';

export interface PropDef {
  type:
    | 'house'
    | 'sign'
    | 'rock'
    | 'fountain'
    | 'lamp'
    | 'fence'
    | 'flower'
    | 'bench'
    | 'planter'
    | 'table'
    | 'bed'
    | 'shelf'
    | 'package';
  x: number;
  y: number;
  w?: number;
  d?: number;
  solid?: boolean;
  color?: number;
  text?: string;
  /** Si se indica, al interactuar se lanza este guion de src/story/script.ts */
  dialog?: string;
  /** Texto del aviso al acercarse (por defecto, el del tipo de prop) */
  label?: string;
}

export interface NpcDef {
  id: string;
  name: string;
  x: number;
  y: number;
  palette: 'rival' | 'prof' | 'trainer' | 'kid' | 'villager';
  /** id del guion de diálogo (src/story/script.ts) */
  dialog: string;
  facing?: number;
  /** Sólo aparece si el jugador tiene esta flag */
  requiresFlag?: string;
  /** Desaparece en cuanto el jugador consigue esta flag */
  hiddenAfterFlag?: string;
}

export interface WarpDef {
  x: number;
  y: number;
  toMap: string;
  toX: number;
  toY: number;
  facing?: number;
  /** La puerta sólo funciona si el jugador tiene esta flag */
  requiresFlag?: string;
}

export interface EncounterEntry {
  speciesId: string;
  min: number;
  max: number;
  weight: number;
}

export interface MapDef {
  id: string;
  name: string;
  w: number;
  h: number;
  tiles: string[];
  props: PropDef[];
  npcs: NpcDef[];
  warps: WarpDef[];
  encounters: EncounterEntry[];
  sky: number;
  fog: number;
  spawn: { x: number; y: number };
}

/* ------------------------------------------------------------------ */

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

class Grid {
  rows: string[][];

  constructor(
    public w: number,
    public h: number,
    fill: TileChar = ',',
  ) {
    this.rows = Array.from({ length: h }, () => Array.from({ length: w }, () => fill as string));
  }

  set(x: number, y: number, c: TileChar): void {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    this.rows[y][x] = c;
  }

  get(x: number, y: number): string {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return 'T';
    return this.rows[y][x];
  }

  rect(x: number, y: number, w: number, h: number, c: TileChar): void {
    for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) this.set(i, j, c);
  }

  border(c: TileChar = 'T'): void {
    for (let x = 0; x < this.w; x++) {
      this.set(x, 0, c);
      this.set(x, this.h - 1, c);
    }
    for (let y = 0; y < this.h; y++) {
      this.set(0, y, c);
      this.set(this.w - 1, y, c);
    }
  }

  path(points: [number, number][], width = 1, c: TileChar = '.'): void {
    for (let i = 0; i < points.length - 1; i++) {
      const [x1, y1] = points[i];
      const [x2, y2] = points[i + 1];
      const steps = Math.max(Math.abs(x2 - x1), Math.abs(y2 - y1));
      for (let s = 0; s <= steps; s++) {
        const t = steps === 0 ? 0 : s / steps;
        const x = Math.round(x1 + (x2 - x1) * t);
        const y = Math.round(y1 + (y2 - y1) * t);
        for (let w = 0; w < width; w++) this.set(x + w, y, c);
      }
    }
  }

  scatter(count: number, chars: TileChar[], seed: number, onlyOn: TileChar[] = [',']): void {
    const rand = mulberry32(seed);
    let placed = 0;
    let guard = 0;
    while (placed < count && guard < count * 60) {
      guard++;
      const x = 1 + Math.floor(rand() * (this.w - 2));
      const y = 1 + Math.floor(rand() * (this.h - 2));
      if (!onlyOn.includes(this.get(x, y) as TileChar)) continue;
      this.set(x, y, chars[Math.floor(rand() * chars.length)]);
      placed++;
    }
  }

  toStrings(): string[] {
    return this.rows.map((r) => r.join(''));
  }
}

/* ------------------------------------------------------------------ */
/* Pueblo de Arcilla                                                   */
/* ------------------------------------------------------------------ */

function buildTown(): MapDef {
  const w = 30;
  const h = 24;
  const g = new Grid(w, h, ',');
  g.border('T');

  // camino principal norte-sur
  g.path(
    [
      [14, 1],
      [14, 20],
    ],
    2,
    '.',
  );

  // plaza central
  for (let y = 8; y <= 16; y++) {
    for (let x = 9; x <= 21; x++) {
      const dx = (x - 15) / 6;
      const dy = (y - 12) / 4.5;
      if (dx * dx + dy * dy <= 1) g.set(x, y, 's');
    }
  }
  // caminos laterales
  g.path(
    [
      [9, 12],
      [21, 12],
    ],
    2,
    '.',
  );
  g.path(
    [
      [22, 12],
      [28, 12],
    ],
    2,
    '.',
  );

  // salida norte (a la ruta)
  g.set(14, 0, '.');
  g.set(15, 0, '.');
  g.set(14, 1, '.');
  g.set(15, 1, '.');

  // jardineras y flores
  g.scatter(26, ['f'], 1337, [',']);
  g.scatter(18, ['T'], 991, [',']);

  return {
    id: 'pueblo',
    name: 'Pueblo Arcilla',
    w,
    h,
    tiles: g.toStrings(),
    props: [
      // Laboratorio de la Profesora Encina (tejado naranja)
      { type: 'house', x: 6, y: 5, w: 5, d: 4, solid: true, color: 0xd97b2f },
      // Tu casa (tejado azul)
      { type: 'house', x: 20, y: 4, w: 7, d: 4, solid: true, color: 0x3f6fa8 },
      // Casa de Bel (suroeste)
      { type: 'house', x: 5, y: 16, w: 4, d: 3, solid: true, color: 0x3f6fa8 },
      // Casa de Cheren (sureste)
      { type: 'house', x: 22, y: 16, w: 5, d: 4, solid: true, color: 0x3f6fa8 },
      { type: 'fountain', x: 15, y: 12, solid: true },
      { type: 'lamp', x: 11, y: 9 },
      { type: 'lamp', x: 19, y: 9 },
      { type: 'lamp', x: 11, y: 15 },
      { type: 'lamp', x: 19, y: 15 },
      { type: 'sign', x: 17, y: 20, text: 'Pueblo Arcilla — donde comienzan los viajes.' },
      { type: 'sign', x: 13, y: 3, text: 'Norte: Ruta 1. Laboratorio de la Profesora Encina al noroeste.' },
      { type: 'sign', x: 17, y: 2, text: 'Pueblo Terracota al norte. Bosque de Teselia al este.' },
    ],
    npcs: [
      {
        id: 'cheren_pueblo',
        name: 'Cheren',
        x: 9,
        y: 9,
        palette: 'rival',
        dialog: 'cheren_pueblo',
        requiresFlag: 'videomisor',
        facing: -Math.PI / 2,
      },
      {
        id: 'bel_paso',
        name: 'Bel',
        x: 14,
        y: 3,
        palette: 'villager',
        dialog: 'bel_paso',
        requiresFlag: 'mapa',
        facing: Math.PI,
      },
      {
        id: 'madre_calle',
        name: 'Madre',
        x: 23,
        y: 10,
        palette: 'villager',
        dialog: 'madre_mapa',
        requiresFlag: 'pokedex',
        facing: Math.PI,
      },
      { id: 'vecina', name: 'Vecina', x: 18, y: 18, palette: 'villager', dialog: 'vecina' },
      { id: 'nino', name: 'Niño', x: 10, y: 20, palette: 'kid', dialog: 'nino' },
    ],
    warps: [
      { x: 14, y: 0, toMap: 'ruta1', toX: 14, toY: 32 },
      { x: 8, y: 9, toMap: 'lab', toX: 6, toY: 7, facing: 0, requiresFlag: 'bel_avisada' },
      { x: 23, y: 8, toMap: 'casa_p2', toX: 5, toY: 6, facing: 0 },
      { x: 6, y: 19, toMap: 'casa_bel', toX: 5, toY: 6, facing: 0 },
    ],
    encounters: [],
    sky: 0x9fd7f5,
    fog: 0xbfe4f7,
    spawn: { x: 15, y: 19 },
  };
}

/* ------------------------------------------------------------------ */
/* Ruta 1                                                              */
/* ------------------------------------------------------------------ */

function buildRoute(): MapDef {
  const w = 30;
  const h = 34;
  const g = new Grid(w, h, ',');
  g.border('T');

  // sendero serpenteante
  g.path(
    [
      [14, 32],
      [14, 26],
      [18, 22],
      [18, 16],
      [12, 12],
      [12, 6],
      [14, 2],
    ],
    2,
    '.',
  );

  // hierba alta
  g.rect(4, 22, 8, 8, 'g');
  g.rect(20, 12, 7, 9, 'g');
  g.rect(5, 6, 7, 7, 'g');
  g.rect(21, 26, 6, 5, 'g');

  // laguna decorativa
  g.rect(4, 14, 5, 4, 'W');

  g.scatter(46, ['T'], 4242, [',']);
  g.scatter(16, ['#'], 777, [',']);
  g.scatter(20, ['f'], 808, [',']);

  // entrada y salida
  g.set(14, 0, '.');
  g.set(15, 0, '.');
  g.set(14, 1, '.');
  g.set(15, 1, '.');
  g.set(14, 33, '.');
  g.set(15, 33, '.');

  return {
    id: 'ruta1',
    name: 'Ruta 1',
    w,
    h,
    tiles: g.toStrings(),
    props: [
      { type: 'sign', x: 16, y: 30, text: 'Ruta 1 — Hierba alta por delante.' },
      { type: 'sign', x: 16, y: 3, text: 'Norte: Pueblo Terracota.' },
      { type: 'sign', x: 16, y: 16, text: 'Consejo: esquiva con ESPACIO y castiga en la recarga.' },
      { type: 'rock', x: 26, y: 8, solid: true },
      { type: 'rock', x: 3, y: 9, solid: true },
      { type: 'fence', x: 22, y: 22, w: 4 },
      { type: 'lamp', x: 20, y: 30 },
    ],
    npcs: [
      { id: 'joven_ruta', name: 'Joven Leo', x: 11, y: 27, palette: 'trainer', dialog: 'trainer_leo' },
      { id: 'senderista', name: 'Senderista Eva', x: 19, y: 10, palette: 'trainer', dialog: 'trainer_eva' },
      { id: 'senderista2', name: 'Senderista', x: 24, y: 18, palette: 'villager', dialog: 'senderista' },
      {
        id: 'encina_ruta',
        name: 'Profesora Encina',
        x: 17,
        y: 29,
        palette: 'prof',
        dialog: 'encina_ruta',
        requiresFlag: 'mapa',
      },
    ],
    warps: [
      { x: 14, y: 33, toMap: 'pueblo', toX: 14, toY: 2, facing: Math.PI },
      { x: 14, y: 0, toMap: 'terracota', toX: 14, toY: 22, facing: Math.PI },
    ],
    encounters: [
      { speciesId: 'patrat', min: 2, max: 5, weight: 35 },
      { speciesId: 'lillipup', min: 2, max: 4, weight: 25 },
      { speciesId: 'pidove', min: 2, max: 5, weight: 22 },
      { speciesId: 'purrloin', min: 3, max: 5, weight: 18 },
    ],
    sky: 0xa8dcf0,
    fog: 0xc9e8f2,
    spawn: { x: 14, y: 30 },
  };
}

/* ------------------------------------------------------------------ */
/* Bosque de Teselia                                                   */
/* ------------------------------------------------------------------ */

function buildForest(): MapDef {
  const w = 28;
  const h = 26;
  const g = new Grid(w, h, ',');

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const edge = x < 2 || y < 2 || x > w - 3 || y > h - 3;
      if (edge) g.set(x, y, 'T');
    }
  }

  // sendero que cruza el bosque
  g.path(
    [
      [13, 23],
      [13, 18],
      [9, 14],
      [9, 9],
      [14, 6],
      [14, 3],
    ],
    2,
    '.',
  );

  g.rect(17, 14, 7, 7, 'g');
  g.rect(3, 15, 5, 6, 'g');
  g.rect(17, 4, 6, 6, 'g');

  // árboles interiores
  const rand = mulberry32(2024);
  for (let y = 3; y < h - 3; y++) {
    for (let x = 3; x < w - 3; x++) {
      if (g.get(x, y) !== ',') continue;
      if (rand() < 0.14) g.set(x, y, 'T');
    }
  }

  g.scatter(12, ['f'], 5150, [',']);
  g.scatter(6, ['#'], 6060, [',']);

  return {
    id: 'bosque',
    name: 'Bosque de Teselia',
    w,
    h,
    tiles: g.toStrings(),
    props: [
      { type: 'sign', x: 15, y: 21, text: 'Bosque de Teselia. Silencio... demasiado silencio.' },
      { type: 'rock', x: 6, y: 8, solid: true },
      { type: 'rock', x: 21, y: 10, solid: true },
      { type: 'fence', x: 11, y: 3, w: 3 },
    ],
    npcs: [
      { id: 'lider_sombra', name: 'Comandante Vega', x: 14, y: 5, palette: 'rival', dialog: 'boss_vega' },
    ],
    warps: [{ x: 13, y: 23, toMap: 'terracota', toX: 28, toY: 12, facing: Math.PI }],
    encounters: [
      { speciesId: 'purrloin', min: 5, max: 8, weight: 34 },
      { speciesId: 'patrat', min: 5, max: 7, weight: 24 },
      { speciesId: 'roggenrola', min: 5, max: 8, weight: 20 },
      { speciesId: 'blitzle', min: 5, max: 7, weight: 12 },
      { speciesId: 'pidove', min: 5, max: 7, weight: 10 },
    ],
    sky: 0x6f8f7a,
    fog: 0x93b09d,
    spawn: { x: 13, y: 22 },
  };
}

/* ------------------------------------------------------------------ */
/* Interiores                                                          */
/* ------------------------------------------------------------------ */

function roomBase(w: number, h: number): Grid {
  const g = new Grid(w, h, 'r');
  g.border('w');
  return g;
}

function buildPlayerRoom(): MapDef {
  const w = 10;
  const h = 8;
  const g = roomBase(w, h);
  g.set(1, 7, 'r'); // escaleras

  return {
    id: 'casa_p1',
    name: 'Tu habitación',
    w,
    h,
    tiles: g.toStrings(),
    props: [
      { type: 'bed', x: 2, y: 2, solid: true },
      { type: 'shelf', x: 2, y: 1, solid: true },
      { type: 'table', x: 8, y: 1, solid: true },
      {
        type: 'package',
        x: 7,
        y: 2,
        solid: true,
        dialog: 'paquete',
        label: 'Abrir el paquete',
      },
    ],
    npcs: [
      {
        id: 'cheren_habitacion',
        name: 'Cheren',
        x: 4,
        y: 3,
        palette: 'rival',
        dialog: 'cheren_habitacion',
        facing: Math.PI,
        hiddenAfterFlag: 'videomisor',
      },
      {
        id: 'bel_habitacion',
        name: 'Bel',
        x: 6,
        y: 3,
        palette: 'villager',
        dialog: 'bel_habitacion',
        facing: Math.PI,
        hiddenAfterFlag: 'cheren_derrotado',
      },
    ],
    warps: [{ x: 1, y: 7, toMap: 'casa_p2', toX: 1, toY: 6, facing: Math.PI }],
    encounters: [],
    sky: 0x1d1510,
    fog: 0x2b2019,
    spawn: { x: 4, y: 6 },
  };
}

function buildPlayerHouse(): MapDef {
  const w = 10;
  const h = 8;
  const g = roomBase(w, h);
  g.set(1, 1, 'r'); // escaleras al piso de arriba
  g.set(5, 7, 'r'); // puerta

  return {
    id: 'casa_p2',
    name: 'Casa del protagonista',
    w,
    h,
    tiles: g.toStrings(),
    props: [
      { type: 'table', x: 2, y: 4, solid: true },
      { type: 'shelf', x: 8, y: 2, solid: true },
      { type: 'table', x: 7, y: 5, solid: true },
    ],
    npcs: [
      {
        id: 'madre',
        name: 'Madre',
        x: 6,
        y: 3,
        palette: 'villager',
        dialog: 'madre',
        hiddenAfterFlag: 'pokedex',
      },
    ],
    warps: [
      { x: 1, y: 1, toMap: 'casa_p1', toX: 1, toY: 6, facing: 0 },
      { x: 5, y: 7, toMap: 'pueblo', toX: 23, toY: 9, facing: Math.PI },
    ],
    encounters: [],
    sky: 0x1d1510,
    fog: 0x2b2019,
    spawn: { x: 5, y: 6 },
  };
}

function buildBelHouse(): MapDef {
  const w = 10;
  const h = 8;
  const g = roomBase(w, h);
  g.set(5, 7, 'r');

  return {
    id: 'casa_bel',
    name: 'Casa de Bel',
    w,
    h,
    tiles: g.toStrings(),
    props: [
      { type: 'table', x: 5, y: 2, solid: true },
      { type: 'shelf', x: 2, y: 1, solid: true },
      { type: 'shelf', x: 8, y: 1, solid: true },
    ],
    npcs: [
      {
        id: 'bel_casa',
        name: 'Bel',
        x: 4,
        y: 3,
        palette: 'villager',
        dialog: 'bel_casa',
        requiresFlag: 'encargo_bel',
        hiddenAfterFlag: 'bel_avisada',
      },
      { id: 'bel_padre', name: 'Padre de Bel', x: 2, y: 3, palette: 'villager', dialog: 'bel_padre' },
      { id: 'bel_madre', name: 'Madre de Bel', x: 8, y: 3, palette: 'villager', dialog: 'bel_madre' },
    ],
    warps: [{ x: 5, y: 7, toMap: 'pueblo', toX: 6, toY: 20, facing: Math.PI }],
    encounters: [],
    sky: 0x1d1510,
    fog: 0x2b2019,
    spawn: { x: 5, y: 6 },
  };
}

function buildLab(): MapDef {
  const w = 13;
  const h = 9;
  const g = roomBase(w, h);
  g.set(6, 8, 'r');

  return {
    id: 'lab',
    name: 'Laboratorio de la Profesora Encina',
    w,
    h,
    tiles: g.toStrings(),
    props: [
      { type: 'shelf', x: 2, y: 1, solid: true },
      { type: 'shelf', x: 3, y: 1, solid: true },
      { type: 'shelf', x: 4, y: 1, solid: true },
      { type: 'table', x: 10, y: 2, solid: true },
      { type: 'table', x: 8, y: 6, solid: true },
    ],
    npcs: [
      { id: 'encina', name: 'Profesora Encina', x: 9, y: 3, palette: 'prof', dialog: 'encina' },
      {
        id: 'cheren_lab',
        name: 'Cheren',
        x: 4,
        y: 5,
        palette: 'rival',
        dialog: 'cheren_lab',
        requiresFlag: 'bel_avisada',
      },
      {
        id: 'bel_lab',
        name: 'Bel',
        x: 5,
        y: 5,
        palette: 'villager',
        dialog: 'bel_lab',
        requiresFlag: 'bel_avisada',
      },
    ],
    warps: [{ x: 6, y: 8, toMap: 'pueblo', toX: 8, toY: 10, facing: Math.PI }],
    encounters: [],
    sky: 0x1d1510,
    fog: 0x2b2019,
    spawn: { x: 6, y: 7 },
  };
}

/* ------------------------------------------------------------------ */
/* Pueblo Terracota (Fase 5)                                           */
/* ------------------------------------------------------------------ */

function buildTerracota(): MapDef {
  const w = 34;
  const h = 24;
  const g = new Grid(w, h, ',');
  g.border('T');

  // camino principal sur-norte y travesía este-oeste
  g.path(
    [
      [14, 22],
      [14, 10],
    ],
    2,
    '.',
  );
  g.path(
    [
      [8, 12],
      [30, 12],
    ],
    2,
    '.',
  );
  g.rect(13, 9, 8, 6, 's');

  // accesos
  g.set(14, 23, '.');
  g.set(15, 23, '.');

  g.scatter(30, ['T'], 3131, [',']);
  g.scatter(22, ['f'], 4242, [',']);

  return {
    id: 'terracota',
    name: 'Pueblo Terracota',
    w,
    h,
    tiles: g.toStrings(),
    props: [
      // Centro Pokémon (tejado rojo)
      { type: 'house', x: 7, y: 4, w: 7, d: 4, solid: true, color: 0xd94b4b },
      { type: 'sign', x: 10, y: 9, text: 'Centro Pokémon — cura a tu equipo gratis.' },
      { type: 'house', x: 21, y: 4, w: 5, d: 4, solid: true, color: 0x3f6fa8 },
      { type: 'house', x: 22, y: 16, w: 5, d: 4, solid: true, color: 0x4f8f5c },
      { type: 'fountain', x: 16, y: 12, solid: true },
      { type: 'bench', x: 12, y: 15, solid: true },
      { type: 'bench', x: 21, y: 15, solid: true },
      { type: 'planter', x: 13, y: 9, solid: true },
      { type: 'planter', x: 19, y: 9, solid: true },
      { type: 'fence', x: 12, y: 21, w: 2 },
      { type: 'fence', x: 17, y: 21, w: 2 },
      { type: 'lamp', x: 12, y: 10 },
      { type: 'lamp', x: 21, y: 10 },
      { type: 'lamp', x: 12, y: 15 },
      { type: 'lamp', x: 21, y: 15 },
      { type: 'sign', x: 16, y: 20, text: 'Pueblo Terracota — encrucijada de Teselia.' },
      { type: 'sign', x: 27, y: 10, text: 'Este: Bosque de Teselia. Cuidado con lo que vive entre los árboles.' },
    ],
    npcs: [
      { id: 'terracota_vecino', name: 'Vecino', x: 11, y: 16, palette: 'villager', dialog: 'terracota_vecino' },
      { id: 'terracota_nina', name: 'Niña', x: 20, y: 9, palette: 'kid', dialog: 'terracota_nina' },
      { id: 'entrenador_terracota', name: 'Colegial Berto', x: 18, y: 16, palette: 'trainer', dialog: 'trainer_terracota' },
    ],
    warps: [
      { x: 14, y: 23, toMap: 'ruta1', toX: 14, toY: 1, facing: 0 },
      { x: 29, y: 12, toMap: 'bosque', toX: 13, toY: 22, facing: 0 },
      { x: 10, y: 8, toMap: 'centro', toX: 5, toY: 7, facing: 0 },
    ],
    encounters: [],
    sky: 0x9fd7f5,
    fog: 0xbfe4f7,
    spawn: { x: 14, y: 21 },
  };
}

function buildCenter(): MapDef {
  const w = 11;
  const h = 8;
  const g = roomBase(w, h);
  g.set(5, 7, 'r');

  return {
    id: 'centro',
    name: 'Centro Pokémon',
    w,
    h,
    tiles: g.toStrings(),
    props: [
      { type: 'shelf', x: 2, y: 1, solid: true },
      { type: 'shelf', x: 8, y: 1, solid: true },
      { type: 'table', x: 2, y: 3, solid: true },
      { type: 'table', x: 8, y: 3, solid: true },
      { type: 'table', x: 9, y: 5, solid: true },
    ],
    npcs: [
      { id: 'enfermera', name: 'Enfermera Joy', x: 5, y: 3, palette: 'villager', dialog: 'enfermera' },
    ],
    warps: [{ x: 5, y: 7, toMap: 'terracota', toX: 10, toY: 9, facing: Math.PI }],
    encounters: [],
    sky: 0x1d1510,
    fog: 0x2b2019,
    spawn: { x: 5, y: 6 },
  };
}

export const MAPS: Record<string, MapDef> = {
  pueblo: buildTown(),
  ruta1: buildRoute(),
  bosque: buildForest(),
  terracota: buildTerracota(),
  centro: buildCenter(),
  casa_p1: buildPlayerRoom(),
  casa_p2: buildPlayerHouse(),
  casa_bel: buildBelHouse(),
  lab: buildLab(),
};

export const START_MAP = 'casa_p1';
