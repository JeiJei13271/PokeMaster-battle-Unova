/**
 * Territorio de la Fase 4 (arte).
 *
 * Los sprites viven en `public/sprites/` y NO se versionan ni se publican:
 * son material de fans hecho a partir de sprites oficiales y se descargan en
 * cada máquina. El juego funciona sin ellos (modelos low-poly provisionales);
 * en combate, si el archivo existe se usa el sprite y si no, el modelo.
 */
export type SpriteKind = 'pokemon' | 'overworld' | 'trainers' | 'items';

/** Tamaños recomendados (px) para cada tipo de hoja. */
export const SPRITE_SPECS = {
  pokemon: { width: 96, height: 96, pixelated: true },
  overworld: { width: 32, height: 32, pixelated: true },
  trainers: { width: 32, height: 48, pixelated: true },
  items: { width: 32, height: 32, pixelated: true },
} as const;

/** Especies del prólogo; el nombre de archivo es el id canónico. */
export const SPRITE_IDS = [
  'snivy',
  'tepig',
  'oshawott',
  'patrat',
  'lillipup',
  'purrloin',
  'pidove',
  'roggenrola',
  'blitzle',
  'boldore',
] as const;

export function spritePath(kind: SpriteKind, id: string): string {
  return `/sprites/${kind}/${id}.png`;
}

export function pokemonSprite(id: string): string {
  return spritePath('pokemon', id);
}

/** Sprite trasero (el que se ve de tu criatura en combate). */
export function pokemonBackSprite(id: string): string {
  return `/sprites/pokemon/back/${id}.png`;
}

export function overworldSprite(id: string): string {
  return spritePath('overworld', id);
}

export function trainerSprite(id: string): string {
  return spritePath('trainers', id);
}

/** Carga un sprite si existe; devuelve null si todavía no está descargado. */
export function loadSprite(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

/** Precarga los sprites de combate de las especies indicadas. */
export async function preloadPokemonSprites(ids: readonly string[] = SPRITE_IDS) {
  const loaded = new Map<string, HTMLImageElement>();
  await Promise.all(
    ids.map(async (id) => {
      const img = await loadSprite(pokemonSprite(id));
      if (img) loaded.set(id, img);
    }),
  );
  return loaded;
}
