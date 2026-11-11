# Fase 5 — Pueblo Terracota

Estado: **aplicada y verificada**. Esta fase abre el mundo después de la Ruta 1 y añade
el primer punto de apoyo del juego: un pueblo con Centro Pokémon, un entrenador y las
conexiones con el Bosque de Teselia.

## Objetivo

Convertir la salida del tutorial en una progresión clara:

1. El jugador cruza la Ruta 1 y llega a Pueblo Terracota.
2. Cura el equipo en el Centro Pokémon (gratis, sin límite).
3. Vence al Colegial Berto, el primer entrenador del pueblo.
4. Se abre el Bosque de Teselia por el este como siguiente destino.

## Contenido añadido

### Mapas

| Mapa | Tamaño | Función |
| --- | --- | --- |
| `terracota` | 34 × 24 | Pueblo exterior: plaza, fuente, Centro, casas, carteles y NPCs |
| `centro` | 11 × 8 | Interior del Centro Pokémon: Enfermera Joy y mostrador |

- **Pueblo Terracota**: camino de tierra sur–norte que desemboca en una plaza; el Centro
  Pokémon tiene tejado rojo al noroeste, dos casas decorativas (azul y verde) y una fuente
  central. Farolas, flores y árboles usan los props existentes.
- **Centro Pokémon**: habitación de interior cálida con estanterías, mesas y la enfermera.

### Conexiones (warps)

| Desde | Hasta | Cuándo |
| --- | --- | --- |
| `ruta1` (14, 0) | `terracota` (14, 22) | Cruzar el norte de la Ruta 1 |
| `terracota` (14, 23) | `ruta1` (14, 1) | Volver al sur |
| `terracota` (10, 8) | `centro` (5, 7) | Entrar al Centro |
| `centro` (5, 7) | `terracota` (10, 9) | Salir del Centro |
| `terracota` (29, 12) | `bosque` (13, 22) | Ir al Bosque por el este |
| `bosque` (13, 23) | `terracota` (28, 12) | Volver del Bosque |

Los warps tienen bloqueo de ~0,9 s al cargar la zona y **reintentan** si el jugador llega
a la casilla antes de que expire (no se pierde el evento).

### NPCs y guiones

| NPC | Guion | Efecto |
| --- | --- | --- |
| Enfermera Joy | `enfermera` | Cura el equipo al completo, marca `centro_visitado` y recuerda hablar con Berto |
| Colegial Berto | `trainer_terracota` | Combate con Patrat Lv. 6 y Purrloin Lv. 7; al ganar marca `berto_derrotado`, da 200 XP y abre el bosque |
| Vecino | `terracota_vecino` | Pistas sobre el Centro y la geografía |
| Niña | `terracota_nina` | Ambiente y aviso sobre el bosque |

### Objetivos y flags

- Al entrar por primera vez en `terracota`: flag `terracota_visto`, aviso y objetivo
  «Cura a tu equipo en el Centro Pokémon».
- La enfermera cambia el objetivo a «Habla con el Colegial Berto, junto a la fuente».
- Al ganar a Berto: objetivo «Cruza el Bosque de Teselia por el este».
- Si el jugador pierde contra Berto, se cura solo y vuelve el objetivo al Centro.

## Cómo se ha construido

1. **Datos del mapa** en `src/world/maps.ts` con `Grid` (`border`, `path`, `rect`,
   `scatter`), props (`house`, `fountain`, `lamp`, `sign`, `shelf`, `table`) y NPCs con
   `dialog` apuntando a `SCRIPTS`.
2. **Guiones** en `src/story/script.ts` usando `StoryCtx` (`say`, `battle`, `heal`,
   `setFlag`, `objective`, `toast`). El combate del entrenador usa `trainerBattle`.
3. **Llegada** en `main.ts` (`onWarp`): la primera entrada al pueblo fija flag y objetivo.
4. **Warps** en `overworld.ts`: bloqueo con reintento para no perder la casilla si se
   pisa durante la transición.
5. **Diálogo**: `DialogueUI.close()` resuelve la espera pendiente para que cerrar un
   guion a mitad no deje el movimiento bloqueado.

## Verificación realizada

- `npm run build` sin errores.
- Test estructural de mapas: todos los `dialog` existen, todos los warps caen en casillas
  transitables y las cadenas de mapas son coherentes (incluidos `terracota` y `centro`).
- Test de historia: 37 comprobaciones del prólogo siguen pasando.
- Navegador:
  - Ruta 1 → Pueblo Terracota al caminar al norte (spawn 14, 22).
  - Puerta del Centro → interior y vuelta al pueblo.
  - Este del pueblo → Bosque de Teselia (spawn 13, 22).
  - Enfermera: HP 5 → 89, flag `centro_visitado`, objetivo actualizado.
  - Berto: combate con Patrat Lv. 6, victoria, flag `berto_derrotado`, objetivo del bosque.
- Sprites de combate: aliado y rival cargan sus PNG (trasero/frontal) y se ocultan los
  modelos; sin PNG se mantiene el modelo low-poly.

Capturas: `artifacts/fase5-terracota.png`, `artifacts/fase5-centro.png`,
`artifacts/fase4-sprites.png`.

## Siguiente fase propuesta (Fase 6)

**Bosque de Teselia jugable**: encuentros con las especies que faltan (Pidove, Blitzle,
Roggenrola, Boldore), un par de entrenadores con equipos de 2–3 criaturas, un claro con
guion de Team Plasma y la salida este hacia la siguiente ciudad. Reutiliza el patrón de
esta fase: mapa → NPCs/guiones → flags → objetivos → verificación estructural y en
navegador.
