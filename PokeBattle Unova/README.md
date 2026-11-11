# PokeMaster Battle Unova

Motor de demostración de un RPG de criaturas con **mundo 3D** y **combates en tiempo real**, inspirado en la estructura de los juegos clásicos de la saga (pueblo natal, profesor, criatura inicial, rival, ruta con entrenadores, bosque y jefe).

No es un romhack ni un port: es un motor propio, escrito desde cero con Three.js y TypeScript, con **contenido original** (historia, nombres y modelos de marcador de posición). No usa ni redistribuye archivos de Nintendo y **no necesita ninguna ROM**.

---

## Arrancar

```bash
npm install
npm run dev      # http://localhost:3000
```

Otros scripts:

```bash
npm run typecheck   # TypeScript en modo estricto
npm run build       # typecheck + build de producción en dist/
npm run preview     # sirve dist/
```

Requisitos: Node 20+ y un navegador con WebGL2.

---

## Controles

**Mundo**

| Tecla | Acción |
| --- | --- |
| `WASD` / flechas | Moverte |
| `Shift` | Correr |
| `E` | Hablar / leer carteles / avanzar diálogo |
| `1`–`3` | Elegir opción en un diálogo |
| `Tab` | Panel de ayuda |

**Combate en tiempo real**

| Tecla | Acción |
| --- | --- |
| `WASD` / flechas | Moverte por la arena |
| `Shift` | Correr |
| `1`–`4` | Lanzar el movimiento de esa ranura |
| `Espacio` | Esquivar (invulnerabilidad breve, cuesta energía) |
| `C` | Lanzar captura (sólo criaturas salvajes) |

La barra azul es la **energía**: los ataques la consumen y se regenera con el tiempo. Cada movimiento tiene su propia recarga (el velo oscuro sobre la ranura). El daño aplica la tabla de tipos, así que un ataque súper eficaz hace el doble y uno poco eficaz la mitad.

**Mando (gamepad)**

| Botón | Acción |
| --- | --- |
| Stick izquierdo / cruceta | Moverte |
| `A` | Hablar en el mundo; movimiento 1 en combate |
| `B` / `X` / `Y` | Movimientos 2, 3 y 4 |
| `RB` | Esquivar |
| `LB` | Capturar |
| `RT` | Correr |
| `X` (mundo) / `Start` | Abrir controles |

**Táctil (móvil)**

Joystick virtual a la izquierda y botones `A/B/X/Y` a la derecha; en el mundo `A` habla y `B` abre el menú de controles, y en combate los cuatro botones muestran el nombre del movimiento. `ESQUIVA` y `CAPTURA` quedan encima. Se activa solo en pantallas táctiles o desde el selector de controles (botón ⚙ o `Tab`), que guarda la preferencia entre partidas.

Durante un diálogo los controles se ocultan para no tapar el texto: **toca la caja de diálogo** para completar la frase y pasar a la siguiente; las opciones también se eligen tocándolas.

Si tu equipo cae, no se pierde nada: vuelves al pueblo con el equipo curado.

---

## Qué incluye la demo

- Mundo conectado **Pueblo Arcilla → Ruta 1 → Pueblo Terracota → Bosque de Teselia**, más cinco interiores: tu habitación, la planta baja de tu casa, la casa de Bel, el laboratorio de la Profesora Encina y el Centro Pokémon. Colisiones por tiles, props sólidos, puertas con guion, hierba alta con encuentros y carteles.
- **Pueblo Terracota (Fase 5)**: plaza con fuente, Centro Pokémon que cura el equipo gratis, vecinos con pistas, el Colegial Berto como primer entrenador del pueblo y salidas al sur (Ruta 1) y al este (Bosque de Teselia). Al llegar se activa el objetivo de curar en el Centro.
- 10 criaturas de Teselia, 22 movimientos, 8 tipos y tabla de efectividad.
- Combate en tiempo real con proyectiles, telegráficos enemigos, esquiva, captura, equipos de varios combatientes y experiencia/niveles. Arena con cielo degradado, nubes, banderines, hierba y flores, sombras de contacto y un HUD con retratos, barra de vida con estela de daño, energía y estados (LENTO/ATK/DEF).
- Controles intercambiables: teclado, mando (detección automática) y táctil con joystick virtual, seleccionables desde el panel de controles.
- **Sprites de overworld pixel art** para el protagonista y todos los NPC (billboard sobre el mundo 3D, con cuatro direcciones y animación al caminar), al estilo de PBA. Bel aparece en tu habitación desde el principio.
- Prólogo de Pueblo Arcilla: paquete con los tres iniciales, combates contra Bel y Cheren, Videomisor, Pokédex, mapa y tutorial de captura en la Ruta 1. Después, los entrenadores de ruta y el jefe de la demo.
- Guardado automático en `localStorage` (al cambiar de zona y al terminar un combate) y botón **Continuar**.

El mundo usa arte procedural de marcador de posición (low-poly). En combate, las criaturas se dibujan como **sprites pixel art generados por código** (`src/data/creatureSprites.ts`): silueta y detalles según la forma de la especie (serpiente, cuadrúpedo, bípedo, ave o roca), colores de `body`/`accent`, vista frontal o trasera, dos frames de paso, respiración y embestida. No se usan los PNG estáticos de batalla del juego original.

---

## Slots de arte: sprites, modelos y sonidos

El motor está preparado para que sustituyas los modelos por tus propios recursos sin tocar la lógica de juego. Los recursos de referencia que quieras usar (por ejemplo, las hojas de *Pokémon Negro 2 / Blanco 2* de spriters-resource) son de sus autores y de Nintendo: úsalos sólo en un proyecto fan no comercial, respetando sus condiciones y dando crédito. No subas assets extraídos a repositorios públicos.

### 1. Criaturas

Cada especie vive en [`src/data/species.ts`](src/data/species.ts):

```ts
snivy: {
  id: 'snivy', name: 'Snivy', types: ['grass'],
  shape: 'serpent',                  // forma del modelo provisional
  size: 0.95, body: 0x4e9a5f, accent: 0xf2e8a0,
  base: { hp: 45, atk: 45, def: 55 },
  learnset: [
    { level: 1, move: 'placaje' },       // los dos de nivel 1 = al nacer
    { level: 1, move: 'latigo_cepa' },
    { level: 6, move: 'hoja_afilada' },
    { level: 9, move: 'gigadrenado' },
    { level: 12, move: 'sintesis' },
  ],
  eggMoves: ['pulso_umbrio', 'ataque_rapido'],  // sólo por cría
}
```

- `id` es la clave que usan mapas, encuentros y guion. Renómbralo o añade especies nuevas en este objeto.
- **Movimientos por nivel**: `learnset` empieza con dos movimientos de nivel 1. Al subir de nivel se aprenden los siguientes; con 4 activos, el nuevo sustituye al más antiguo (estilo PBA).
- **Movimientos de huevo**: `eggMoves` está separado del learnset. Nunca se conocen al capturar ni al recibir la criatura; son la base para la cría o el tutor de movimientos.
- La **vida** usa la curva del PBA (`hp base × 1.6 + nivel × 3.5`), pensada para barras largas de combate en tiempo real, no la fórmula por turnos de la saga principal.
- `shape`, `size`, `body` y `accent` sólo alimentan el modelo provisional de [`src/world/models.ts`](src/world/models.ts) (`createCreature`). Para usar sprites o modelos reales, sustituye esa función por un cargador (`THREE.TextureLoader` para un cartel 2D con `Sprite`, o `GLTFLoader` para un modelo) usando `species.id` como nombre de archivo:

```ts
// src/world/models.ts (ejemplo)
const url = `${import.meta.env.BASE_URL}creatures/${species.id}.glb`;
```

Los sprites de combate y los retratos del HUD se generan en `src/data/creatureSprites.ts` a partir de `shape`, `body` y `accent`; no dependen de archivos externos ni de assets oficiales. `Battle.attachSprite` crea un `THREE.Sprite` con filtro nearest y oculta el modelo; al caminar alterna dos frames y la animación procedural añade respiración, balanceo y embestida. El juego escala automáticamente al combatiente en la arena.

- Iconos de la interfaz: hoy la UI usa texto. Puedes añadir retratos en `public/portraits/<id>.png` y mostrarlos en `BattleHUD.setup` (`src/ui/hud.ts`).
- Sonidos: no hay audio todavía. El punto natural es un módulo `src/core/audio.ts` llamado desde `tryCast`, `hit`, `battle-banner` y los diálogos. Coloca los archivos en `public/audio/`.

### 2. Personajes del mundo

`src/world/overworldSprites.ts` dibuja los sprites de jugador y NPC (16×20 px, cuatro direcciones, dos frames) y los pega como billboard sobre el rig 3D. `src/world/overworld.ts` define las paletas de los NPC (`PALETTES`) y del jugador (`PLAYER_PALETTE`).

### 3. Suelo y decorados

- Los tiles se pintan por vértices en `Overworld.buildGround()`: cada carácter del mapa tiene un color en el diccionario `colors`. Puedes sustituirlo por texturas por tile.
- Árboles, rocas, hierba y flores usan `InstancedMesh`; las mallas de props están en `src/world/models.ts` (`createTree`, `createHouse`, `createRock`, `createFountain`, `createLamp`, `createFence`, `createSign`, `createPokeball`).
- La arena de combate se construye en `Battle.buildArena()`; cambiar el suelo/cielo no afecta a la lógica.

---

## Cambiar la historia

El guion está en [`src/story/script.ts`](src/story/script.ts). Cada entrada corresponde al campo `dialog` de un NPC en [`src/world/maps.ts`](src/world/maps.ts):

```ts
export const SCRIPTS: Record<string, Script> = {
  profesor, rival, vecina, nino,
  trainer_leo: trainerLeo,
  trainer_eva: trainerEva,
  senderista, boss_vega: bossVega,
};
```

Un guion recibe un `StoryCtx` ([`src/story/context.ts`](src/story/context.ts)) y puede:

| Método | Uso |
| --- | --- |
| `say(nombre, texto)` | Línea de diálogo (espera a que el jugador pulse `E`) |
| `narrate(texto)` | Línea sin nombre |
| `choice(opciones)` | Menú; devuelve el índice elegido |
| `battle(request)` | Combate en tiempo real; devuelve `'win' \| 'lose' \| 'caught' \| 'flee'` |
| `hasFlag(f)` / `setFlag(f)` | Progresso persistente |
| `objective(texto)` | Cambia el objetivo del HUD |
| `give(especie, nivel)` / `party()` / `heal()` | Equipo |
| `toast(texto)` / `endDemo()` | Avisos y final de la demo |

Para añadir un NPC: créalo en `npcs` del mapa con un `dialog` nuevo y añade la función correspondiente en `SCRIPTS`. Si el id no existe se usa `FALLBACK`.

### Añadir mapas

Copia el patrón de `buildTown` / `buildRoute` / `buildForest` / `buildTerracota` / `buildCenter` en `src/world/maps.ts`: un `Grid` con `border`, `path`, `rect` y `scatter`, más `props`, `npcs`, `warps` y `encounters`, y regístralo en `MAPS`. Las coordenadas son tiles; el tamaño real es `TILE = 2` unidades.

### Añadir movimientos

Añade una entrada a `MOVES` en [`src/data/moves.ts`](src/data/moves.ts) con:

- `category`: `physical`, `special` o `status` (los de estado no hacen daño y usan `effect`).
- `range`: `short`, `medium` o `long` (5.5 / 10 / 16 unidades de arena). Fuera de ese alcance el ataque no sale y aparece «Fuera de alcance».
- `power`, `cooldown`, `energy`, `speed`, `color`, `radius` y `desc`.
- `effect` opcional: `drain`, `slow`, `attack_down`, `defense_up` o `heal`, con `effectValue`.

Después añádelo al `learnset` (con su nivel) o a `eggMoves` de la especie. La tabla de tipos está en el mismo archivo (`typeMultiplier`).

El HUD de combate muestra en cada ranura la categoría (FÍSICO/ESPECIAL/ESTADO), el rango (CORTO/MEDIO/LARGO) y el tipo con su potencia.

---

## Estructura

```
src/
  main.ts            bucle principal, cambio título/mundo/combate, guardado
  game.ts            estado de partida y persistencia (localStorage)
  types.ts           tipos compartidos
  core/input.ts      teclado y vector de movimiento
  data/moves.ts      movimientos (categoría, rango, efectos) y tabla de tipos
  data/species.ts    roster, learnsets, movimientos huevo, daño y experiencia
  data/creatureSprites.ts  sprites de criatura y retratos generados por código
  world/maps.ts      definición de mapas, props, NPCs, warps y encuentros
  world/models.ts    modelos low-poly procedurales
  world/overworld.ts render del mundo, colisiones, cámara, encuentros
  battle/battle.ts   combate en tiempo real (arena, IA, proyectiles, captura)
  story/context.ts   interfaz que ve el guion
  story/script.ts    historia de la demo
  ui/dialogue.ts     cajas de diálogo y elecciones
  ui/hud.ts          HUD, toasts, daño flotante, banners
```

El juego alterna entre `Overworld` y `Battle`; ambos tienen su propia escena y cámara, y comparten `Input` y el estado de partida. Al terminar un combate, `main.ts` aplica experiencia, capturas, curación y guarda.

Desde la consola del navegador hay un acceso de depuración: `window.__bva` (estado, mundo, combate, diálogo y `startBattle`). Útil para probar encuentros sin caminar.

---

## Limitaciones conocidas

- Contenido de demostración: pueblo, ruta, bosque y cuatro interiores; 10 criaturas; ~15 minutos de historia. Recrea el prólogo de Pueblo Arcilla con texto original.
- Arte procedural low-poly; sin audio ni animaciones de captura elaboradas.
- Sin soporte táctil/móvil ni multijugador.
- Balance pensado para probar el sistema, no para un RPG completo.
- El bundle ronda los 600 kB (Three.js incluido); si crece, conviene separar el combate con `import()` dinámico.
