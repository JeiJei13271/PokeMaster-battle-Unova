const BLOCKED = new Set([
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'Space',
  'Tab',
  'KeyE',
]);

export type ControlScheme = 'auto' | 'keyboard' | 'gamepad' | 'touch';
export type InputContext = 'world' | 'battle';
export type TouchAction = 'move1' | 'move2' | 'move3' | 'move4' | 'dodge' | 'capture' | 'interact' | 'menu';

const SCHEME_KEY = 'pba-controls-scheme';

export function prefersTouch(): boolean {
  return (
    typeof window !== 'undefined' &&
    (('ontouchstart' in window) || window.matchMedia('(pointer: coarse)').matches)
  );
}

export class Input {
  private down = new Set<string>();
  private pressed = new Set<string>();

  /** Entradas virtuales (mando y táctil) que se suman al teclado. */
  private padDown = new Set<string>();
  private padPrev = new Set<string>();
  private touchDown = new Set<string>();
  private touchPressed = new Set<string>();
  private touchVectorX = 0;
  private touchVectorY = 0;

  private context: InputContext = 'world';
  private scheme: ControlScheme = 'auto';
  private gamepadId: string | null = null;

  constructor() {
    const saved = localStorage.getItem(SCHEME_KEY) as ControlScheme | null;
    if (saved === 'auto' || saved === 'keyboard' || saved === 'gamepad' || saved === 'touch') {
      this.scheme = saved;
    }
    window.addEventListener('keydown', (e) => {
      if (BLOCKED.has(e.code)) e.preventDefault();
      if (e.repeat) return;
      this.down.add(e.code);
      this.pressed.add(e.code);
    });
    window.addEventListener('keyup', (e) => {
      this.down.delete(e.code);
    });
    window.addEventListener('blur', () => {
      this.down.clear();
      this.pressed.clear();
      this.touchDown.clear();
      this.touchPressed.clear();
      this.padDown.clear();
      this.padPrev.clear();
    });
    window.addEventListener('gamepadconnected', (e) => {
      this.gamepadId = e.gamepad.id;
      if (this.scheme === 'auto') this.setScheme('gamepad');
    });
    window.addEventListener('gamepaddisconnected', () => {
      this.gamepadId = null;
    });
  }

  setContext(context: InputContext): void {
    this.context = context;
  }

  getContext(): InputContext {
    return this.context;
  }

  getScheme(): ControlScheme {
    return this.scheme;
  }

  setScheme(scheme: ControlScheme): void {
    this.scheme = scheme;
    localStorage.setItem(SCHEME_KEY, scheme);
    if (scheme !== 'touch') this.resetTouch();
  }

  /** Mando conectado (o detectado en el último poll). */
  hasGamepad(): boolean {
    return this.gamepadId !== null;
  }

  /** ¿Debe mostrarse el joystick en pantalla? */
  touchEnabled(): boolean {
    if (this.scheme === 'touch') return true;
    if (this.scheme === 'auto') return prefersTouch();
    return false;
  }

  /* ---------------------------------------------------------------- */
  /* Mando                                                            */
  /* ---------------------------------------------------------------- */

  poll(): void {
    if (this.scheme === 'keyboard' || this.scheme === 'touch') {
      this.padDown.clear();
      this.padPrev.clear();
      return;
    }
    const pads = typeof navigator.getGamepads === 'function' ? navigator.getGamepads() : [];
    let pad: Gamepad | null = null;
    for (const candidate of pads) {
      if (candidate && candidate.connected) {
        pad = candidate;
        break;
      }
    }
    if (!pad) {
      this.gamepadId = null;
      this.padDown.clear();
      this.padPrev.clear();
      return;
    }
    this.gamepadId = pad.id;

    const held = new Set<string>();
    const button = (i: number) => Boolean(pad!.buttons[i]?.pressed || (pad!.buttons[i]?.value ?? 0) > 0.4);

    // Stick izquierdo y cruceta → movimiento.
    const ax = pad.axes[0] ?? 0;
    const ay = pad.axes[1] ?? 0;
    if (ax < -0.35 || button(14)) held.add('KeyA');
    if (ax > 0.35 || button(15)) held.add('KeyD');
    if (ay < -0.35 || button(12)) held.add('KeyW');
    if (ay > 0.35 || button(13)) held.add('KeyS');

    if (button(7)) held.add('ShiftLeft'); // RT correr

    if (this.context === 'battle') {
      // A / B / X / Y = los cuatro movimientos (como en PBA).
      if (button(0)) held.add('Digit1');
      if (button(1)) held.add('Digit2');
      if (button(2)) held.add('Digit3');
      if (button(3)) held.add('Digit4');
      if (button(5)) held.add('Space'); // RB esquivar
      if (button(4)) held.add('KeyC'); // LB capturar
    } else {
      if (button(0)) held.add('KeyE'); // A hablar
      if (button(2)) held.add('Tab'); // X ayuda
      if (button(9)) held.add('Tab'); // Start ayuda
    }

    for (const code of this.padPrev) {
      if (!held.has(code)) this.padDown.delete(code);
    }
    for (const code of held) {
      if (!this.padPrev.has(code)) {
        this.padDown.add(code);
        this.pressed.add(code);
      }
    }
    this.padPrev = held;
  }

  /* ---------------------------------------------------------------- */
  /* Táctil                                                           */
  /* ---------------------------------------------------------------- */

  setTouchVector(x: number, y: number): void {
    this.touchVectorX = x;
    this.touchVectorY = y;
  }

  resetTouch(): void {
    this.touchVectorX = 0;
    this.touchVectorY = 0;
    this.touchDown.clear();
    this.touchPressed.clear();
  }

  /** Botones táctiles: traducen la acción al código de teclado del contexto. */
  pressAction(action: TouchAction): void {
    const code = this.actionCode(action);
    if (!code || this.touchDown.has(code)) return;
    this.touchDown.add(code);
    this.touchPressed.add(code);
  }

  releaseAction(action: TouchAction): void {
    const code = this.actionCode(action);
    if (code) this.touchDown.delete(code);
  }

  private actionCode(action: TouchAction): string | null {
    if (this.context === 'battle') {
      switch (action) {
        case 'move1': return 'Digit1';
        case 'move2': return 'Digit2';
        case 'move3': return 'Digit3';
        case 'move4': return 'Digit4';
        case 'dodge': return 'Space';
        case 'capture': return 'KeyC';
        case 'interact': return 'KeyE';
        case 'menu': return 'Tab';
      }
    }
    switch (action) {
      case 'interact': return 'KeyE';
      case 'menu': return 'Tab';
      case 'dodge': return 'Space';
      case 'capture': return 'KeyC';
      default: return null;
    }
  }

  /* ---------------------------------------------------------------- */

  isDown(...codes: string[]): boolean {
    return codes.some((c) => this.down.has(c) || this.padDown.has(c) || this.touchDown.has(c));
  }

  wasPressed(...codes: string[]): boolean {
    return codes.some((c) => this.pressed.has(c) || this.touchPressed.has(c));
  }

  /** Vector de movimiento normalizado en espacio de pantalla (x derecha, y adelante). */
  moveVector(): { x: number; y: number } {
    let x = 0;
    let y = 0;
    if (this.isDown('KeyW', 'ArrowUp')) y += 1;
    if (this.isDown('KeyS', 'ArrowDown')) y -= 1;
    if (this.isDown('KeyA', 'ArrowLeft')) x -= 1;
    if (this.isDown('KeyD', 'ArrowRight')) x += 1;
    x += this.touchVectorX;
    y += this.touchVectorY;
    const len = Math.hypot(x, y);
    if (len > 1) {
      x /= len;
      y /= len;
    }
    return { x, y };
  }

  /** Etiqueta visible para una acción según el esquema activo. */
  label(action: 'move1' | 'move2' | 'move3' | 'move4' | 'interact' | 'dodge' | 'capture' | 'sprint' | 'help'): string {
    const scheme = this.scheme;
    if (scheme === 'gamepad' || (scheme === 'auto' && this.hasGamepad())) {
      const pad: Record<string, string> = {
        move1: 'A',
        move2: 'B',
        move3: 'X',
        move4: 'Y',
        interact: 'A',
        dodge: 'RB',
        capture: 'LB',
        sprint: 'RT',
        help: 'START',
      };
      return pad[action];
    }
    if (scheme === 'touch' || (scheme === 'auto' && prefersTouch())) {
      const touch: Record<string, string> = {
        move1: 'A',
        move2: 'B',
        move3: 'X',
        move4: 'Y',
        interact: 'A',
        dodge: 'ESQ',
        capture: 'CAP',
        sprint: 'CORRER',
        help: '☰',
      };
      return touch[action];
    }
    const keys: Record<string, string> = {
      move1: '1',
      move2: '2',
      move3: '3',
      move4: '4',
      interact: 'E',
      dodge: 'ESPACIO',
      capture: 'C',
      sprint: 'SHIFT',
      help: 'TAB',
    };
    return keys[action];
  }

  endFrame(): void {
    this.pressed.clear();
    this.touchPressed.clear();
  }
}
