# Sprites (Fase 4)

Esta carpeta es el punto de entrada del arte de **PokeMaster Battle Unova**.
Los archivos `.png` **no se versionan** (ver `.gitignore`): son material de fans
y cada máquina se los descarga en local. El juego arranca sin ellos usando los
modelos low-poly provisionales.

## Estructura

```
public/sprites/
  pokemon/<id>.png      sprite de combate (frontal), 96×96, pixel art
  overworld/<id>.png    sprite de mundo, 32×32 (opcional)
  trainers/<id>.png     entrenadores, 32×48
  items/<id>.png        objetos (Poké Ball, Pokédex, mapa...), 32×32
```

Los `<id>` son los ids canónicos en inglés de `src/data/species.ts`:

`snivy`, `tepig`, `oshawott`, `patrat`, `lillipup`, `purrloin`, `pidove`,
`roggenrola`, `blitzle`, `boldore`.

Entrenadores: `player`, `cheren`, `bel`, `encina`, `madre`, `leo`, `eva`,
`vega`.

## Uso desde código

`src/data/sprites.ts` expone:

- `pokemonSprite(id)` / `overworldSprite(id)` / `trainerSprite(id)`
- `loadSprite(src)` → `HTMLImageElement | null` (no rompe si falta el archivo)
- `preloadPokemonSprites(ids)` para precargar el roster
- `SPRITE_SPECS` con los tamaños recomendados

Cuando los sprites estén descargados, la Fase 4 sólo tiene que cambiar el
render de `src/world/models.ts` (mundo) y de `src/battle/battle.ts` (combate)
para usar estas rutas, manteniendo los modelos actuales como fallback.

## Reglas de estilo

- Pixel art sin suavizado (`image-rendering: pixelated`).
- Fondo transparente, personaje centrado y apoyado en la base.
- Misma escala relativa entre especies (Snivy ~0.95, Boldore ~1.35).
- Sin ROMs ni assets extraídos de juegos: sólo hojas públicas de sprites.
