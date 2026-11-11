import * as THREE from 'three';
import './style.css';
import { Input } from './core/input';
import { GameState, readSave, clearSave } from './game';
import { MOVES } from './data/moves';
import { MAPS, START_MAP } from './world/maps';
import { Overworld } from './world/overworld';
import { DialogueUI } from './ui/dialogue';
import { flashScreen, setObjective, showBattleHud, showWorldHud, toast } from './ui/hud';
import { setupTouchControls } from './ui/touch';
import { Battle } from './battle/battle';
import { runScript } from './story/script';
import type { StoryCtx } from './story/context';
import type { BattleOutcome, BattleRequest, Combatant } from './types';

/* ------------------------------------------------------------------ */
/* Renderer                                                            */
/* ------------------------------------------------------------------ */

const stage = document.getElementById('stage')!;
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;
stage.appendChild(renderer.domElement);

const titleScreen = document.getElementById('title-screen')!;
const btnNew = document.getElementById('btn-new') as HTMLButtonElement;
const btnContinue = document.getElementById('btn-continue') as HTMLButtonElement;
const helpPanel = document.getElementById('help-panel')!;

/* ------------------------------------------------------------------ */
/* Estado global                                                       */
/* ------------------------------------------------------------------ */

const state = new GameState();
const input = new Input();
const dialogue = new DialogueUI();
setupTouchControls(input);

let mode: 'title' | 'world' | 'battle' = 'title';
let scriptRunning = false;
let battle: Battle | null = null;
let battleResolve: ((outcome: BattleOutcome) => void) | null = null;

/* ------------------------------------------------------------------ */
/* Contexto de historia                                                */
/* ------------------------------------------------------------------ */

const ctx: StoryCtx = {
  playerName: state.playerName,
  // Si el guion sigue vivo cuando empieza un combate, no debe reabrir el diálogo.
  say: (name, text) => (mode === 'battle' ? Promise.resolve() : dialogue.say(name, text)),
  narrate: (text) => (mode === 'battle' ? Promise.resolve() : dialogue.say('', text)),
  choice: (options) => (mode === 'battle' ? Promise.resolve(0) : dialogue.choice(options)),
  battle: (request) => startBattle(request),
  hasFlag: (flag) => state.flags.has(flag),
  setFlag: (flag) => {
    state.flags.add(flag);
  },
  objective: (text) => {
    state.objectiveText = text;
    setObjective(text);
  },
  toast,
  give: (speciesId, level) => {
    const added = state.give(speciesId, level);
    if (!added) toast('Tu equipo está lleno (máximo 6)');
  },
  party: () => state.party,
  heal: () => state.heal(),
  starterId: () => state.party[0]?.species.id ?? null,
  endDemo: () => {
    state.objectiveText = 'Demo completada · gracias por jugar';
    setObjective(state.objectiveText);
    toast('Has llegado al final de la demo de PokeMaster Battle Unova.', 9000);
    state.save();
  },
};

/* ------------------------------------------------------------------ */
/* Mundo                                                               */
/* ------------------------------------------------------------------ */

const overworld = new Overworld(input, {
  onEncounter: (speciesId, level) => {
    if (mode !== 'world' || dialogue.isOpen) return;
    if (state.party.length === 0) {
      toast('Necesitas una criatura para combatir. Abre el paquete de tu habitación.');
      return;
    }
    void startBattle({ kind: 'wild', canCatch: true, team: [{ speciesId, level }] });
  },
  onInteract: (dialogId) => {
    void playScript(dialogId);
  },
  onWarp: (toMap, x, y, facing) => {
    state.map = toMap;
    state.x = x;
    state.y = y;
    state.facing = facing;
    overworld.load({ map: toMap, x, y, facing });
    flashScreen();
    state.save();

    if (toMap === 'bosque' && !state.flags.has('bosque_visto')) {
      state.flags.add('bosque_visto');
      toast('Bosque de Teselia. El aire huele a tierra removida.');
    }

    if (toMap === 'terracota' && !state.flags.has('terracota_visto')) {
      state.flags.add('terracota_visto');
      state.objectiveText = 'Cura a tu equipo en el Centro Pokémon';
      setObjective(state.objectiveText);
      toast('Pueblo Terracota. El Centro Pokémon está al noroeste, junto a la fuente.', 5200);
      state.save();
    }
  },
  onSign: (text) => {
    void dialogue.say('Cartel', text).then(() => dialogue.close());
  },
  isBusy: () => mode !== 'world' || dialogue.isOpen || scriptRunning,
  hasFlag: (flag) => state.flags.has(flag),
});

async function playScript(id: string): Promise<void> {
  if (scriptRunning) return;
  scriptRunning = true;
  try {
    await runScript(id, ctx);
  } catch (error) {
    console.error('Error en el guion', id, error);
  } finally {
    scriptRunning = false;
    dialogue.close();
    if (mode === 'world') {
      // Los guiones abren y cierran puertas/npcs: reconstruimos la capa visible.
      overworld.refreshNpcs();
      setObjective(state.objectiveText);
      state.save();
    }
  }
}

/* ------------------------------------------------------------------ */
/* Combate                                                             */
/* ------------------------------------------------------------------ */

function startBattle(request: BattleRequest): Promise<BattleOutcome> {
  return new Promise((resolve) => {
    if (!state.party.some((c) => c.hp > 0)) {
      state.heal();
      toast('Tu equipo se ha recuperado antes del combate.');
    }
    const ally = state.lead();
    if (!ally) {
      toast('No tienes criaturas con las que luchar.');
      resolve('lose');
      return;
    }

    dialogue.close();
    mode = 'battle';
    showWorldHud(false);
    showBattleHud(true);
    flashScreen();
    refreshControlUI();
    battleResolve = resolve;

    battle = new Battle({
      ally,
      request,
      input,
      onEnd: handleBattleEnd,
    });
    battle.resize(window.innerWidth / window.innerHeight);
  });
}

function handleBattleEnd(
  outcome: BattleOutcome,
  ally: Combatant,
  enemy: Combatant | null,
  captured?: Combatant,
): void {
  battle?.dispose();
  battle = null;

  showBattleHud(false);
  if (mode === 'battle') {
    mode = 'world';
    showWorldHud(true);
    refreshControlUI();
  }

  if (enemy && (outcome === 'win' || outcome === 'caught')) {
    const xp = 24 + enemy.level * 16;
    const levels = state.awardXp(ally, xp);
    toast(`Has ganado ${xp} de experiencia.`, 2600);
    if (levels > 0) {
      toast(`¡${ally.species.name} sube al nivel ${ally.level}! Su vida se ha restaurado.`, 3600);
    }
    for (const moveId of state.lastLearned) {
      const move = MOVES[moveId];
      if (move) toast(`¡${ally.species.name} ha aprendido ${move.name}!`, 3800);
    }
  }

  if (outcome === 'caught' && captured) {
    if (state.party.length < 6) {
      state.party.push(captured);
      toast(`¡${captured.species.name} se une a tu equipo!`);
    } else {
      toast('Tu equipo está lleno: la criatura se ha liberado.');
    }
  }

  if (outcome === 'lose') {
    state.heal();
    state.map = START_MAP;
    state.x = MAPS[START_MAP].spawn.x;
    state.y = MAPS[START_MAP].spawn.y;
    state.facing = Math.PI;
    overworld.load({ map: state.map, x: state.x, y: state.y, facing: state.facing });
    flashScreen();
    toast('Tu equipo ha sido curado. Vuelves a casa.', 3200);
  }

  setObjective(state.objectiveText);
  state.save();

  const resolve = battleResolve;
  battleResolve = null;
  resolve?.(outcome);
}

/* ------------------------------------------------------------------ */
/* Pantallas                                                           */
/* ------------------------------------------------------------------ */

function showTitle(): void {
  mode = 'title';
  refreshControlUI();
  titleScreen.classList.remove('hidden');
  showWorldHud(false);
  showBattleHud(false);
  setObjective('');
  btnContinue.disabled = readSave() === null;
}

async function introSequence(): Promise<void> {
  scriptRunning = true;
  try {
    await dialogue.say('', 'Pueblo Arcilla, al amanecer. Un lugar pequeño donde las criaturas duermen al sol y nadie tiene prisa.');
    await dialogue.say(
      '',
      'La Profesora Encina ha entrado en tu casa, ha dejado un paquete en tu habitación y ha salido apresurada.',
    );
    await dialogue.say('Cheren', '¿Sigues medio dormido? La profesora ha dejado una caja en tu escritorio. Bel todavía no ha llegado.');
    await dialogue.say('', 'Abre el paquete para empezar tu aventura.');
  } finally {
    scriptRunning = false;
    dialogue.close();
    if (mode === 'world') setObjective(state.objectiveText);
  }
}

function startNewGame(): void {
  clearSave();
  state.reset();

  titleScreen.classList.add('hidden');
  mode = 'world';
  showWorldHud(true);
  setObjective(state.objectiveText);
  overworld.load({ map: state.map, x: state.x, y: state.y, facing: state.facing });
  flashScreen();
  state.save();
  void introSequence();
}

function continueGame(): void {
  if (!state.load()) {
    toast('No hay ninguna partida guardada.');
    btnContinue.disabled = true;
    return;
  }

  titleScreen.classList.add('hidden');
  mode = 'world';
  showWorldHud(true);
  setObjective(state.objectiveText);
  overworld.load({ map: state.map, x: state.x, y: state.y, facing: state.facing });
  flashScreen();
}

btnNew.addEventListener('click', () => startNewGame());
btnContinue.addEventListener('click', () => continueGame());

/* ------------------------------------------------------------------ */
/* Controles: teclado, mando y táctil                                  */
/* ------------------------------------------------------------------ */

const touchRoot = document.getElementById('touch-controls')!;
const worldHint = document.getElementById('world-hint')!;
const battleHint = document.getElementById('battle-hint')!;
const schemeNote = document.getElementById('scheme-note')!;
const schemeButtons = [...document.querySelectorAll<HTMLButtonElement>('.scheme-btn')];

export function refreshControlUI(): void {
  const scheme = input.getScheme();
  const gamepad = scheme === 'gamepad' || (scheme === 'auto' && input.hasGamepad());
  document.body.dataset.scheme = scheme;
  document.body.dataset.context = mode === 'battle' ? 'battle' : 'world';
  for (const button of schemeButtons) {
    button.classList.toggle('active', button.dataset.scheme === scheme);
  }
  schemeNote.textContent = gamepad
    ? 'Mando detectado: stick/cruceta para moverte, A/B/X/Y para los movimientos en combate, RB esquiva, LB captura y RT corre.'
    : input.touchEnabled()
      ? 'Controles táctiles activos: joystick a la izquierda y botones A/B/X/Y a la derecha.'
      : 'Teclado: WASD, E, Shift, 1-4, Espacio y C. También puedes conectar un mando o activar el modo táctil.';

  if (gamepad) {
    worldHint.textContent = 'Stick mover · A hablar · RT correr · START ayuda';
    battleHint.textContent = 'Stick mover · A/B/X/Y ataques · RB esquiva · LB captura';
  } else if (input.touchEnabled()) {
    worldHint.textContent = 'Joystick mover · A hablar · B menú';
    battleHint.textContent = 'Joystick mover · A/B/X/Y ataques · ESQUIVA · CAPTURA';
  } else {
    worldHint.textContent = 'WASD mover · E hablar · Shift correr · Tab ayuda';
    battleHint.textContent = 'WASD mover · 1-4 ataque · Espacio esquiva · C capturar (salvajes)';
  }

  syncTouchButtons();
  touchRoot.classList.toggle('hidden', !input.touchEnabled() || mode === 'title');
}

function setControlsOpen(open: boolean): void {
  helpPanel.classList.toggle('hidden', !open);
}

let touchVisible = false;
let lastContext = '';
/** Ajusta acciones y etiquetas de los botones táctiles al contexto actual. */
function syncTouchButtons(): void {
  const inBattle = mode === 'battle';
  const moveNames = [...document.querySelectorAll<HTMLElement>('#move-bar .move-slot .name')].map(
    (el) => el.textContent ?? '',
  );
  const actions = inBattle ? ['move1', 'move2', 'move3', 'move4'] : ['interact', 'menu', 'move3', 'move4'];
  const captions = inBattle
    ? moveNames.map((name, i) => name || `MOV ${i + 1}`)
    : ['HABLAR', 'MENÚ', 'MOV 3', 'MOV 4'];

  [...touchRoot.querySelectorAll<HTMLButtonElement>('.touch-face')].forEach((button, i) => {
    const action = actions[i];
    const caption = button.querySelector('span');
    if (action) button.dataset.action = action;
    if (caption && captions[i]) caption.textContent = captions[i];
  });
}

function refreshTouchVisibility(): void {
  const visible = input.touchEnabled() && mode !== 'title';
  if (visible !== touchVisible) {
    touchVisible = visible;
    touchRoot.classList.toggle('hidden', !visible);
  }
  document.body.classList.toggle('touch-ui', visible);
  const context = mode === 'battle' ? 'battle' : 'world';
  if (context !== lastContext) {
    lastContext = context;
    document.body.dataset.context = context;
    syncTouchButtons();
    // El bucle puede estar pausado (pestaña en segundo plano): refresca ya.
    refreshTouchVisibility();
  }
}

for (const button of schemeButtons) {
  button.addEventListener('click', () => {
    input.setScheme(button.dataset.scheme as 'auto' | 'keyboard' | 'gamepad' | 'touch');
    refreshControlUI();
  });
}

document.getElementById('btn-controls')?.addEventListener('click', () => setControlsOpen(true));
document.getElementById('btn-close-help')?.addEventListener('click', () => setControlsOpen(false));
window.addEventListener('gamepadconnected', () => {
  window.setTimeout(refreshControlUI, 100);
});
refreshControlUI();

/* ------------------------------------------------------------------ */
/* Bucle principal                                                     */
/* ------------------------------------------------------------------ */

function resize(): void {
  const w = window.innerWidth;
  const h = window.innerHeight;
  renderer.setSize(w, h);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  overworld.resize(w / h);
  battle?.resize(w / h);
}

window.addEventListener('resize', resize);

// Escenario de fondo tras el título.
overworld.load({
  map: 'pueblo',
  x: MAPS.pueblo.spawn.x,
  y: MAPS.pueblo.spawn.y,
  facing: Math.PI,
});
overworld.resize(window.innerWidth / window.innerHeight);
showTitle();

const clock = new THREE.Clock();

renderer.setAnimationLoop(() => {
  const dt = Math.min(0.05, clock.getDelta());
  input.poll();
  input.setContext(mode === 'battle' ? 'battle' : 'world');
  refreshTouchVisibility();

  if (mode === 'battle' && battle) {
    // Nunca dejar un diálogo abierto encima de la arena.
    if (dialogue.isOpen) dialogue.close();
    battle.update(dt);
    renderer.render(battle.scene, battle.camera);
  } else {
    if (mode === 'world') {
      overworld.update(dt);
      if (input.wasPressed('Tab')) setControlsOpen(helpPanel.classList.contains('hidden'));
    }
    if (mode === 'title' && input.wasPressed('Enter')) startNewGame();
    dialogue.update(dt, input);
    renderer.render(overworld.scene, overworld.camera);
  }

  input.endFrame();
});

// Acceso de depuración desde la consola del navegador (no afecta al juego).
(window as unknown as Record<string, unknown>).__bva = {
  state,
  overworld,
  startBattle,
  ctx,
  dialogue,
  playScript,
  get battle() {
    return battle;
  },
};
