import type { Input, TouchAction } from '../core/input';

/**
 * Joystick virtual y botones en pantalla para jugar en el móvil.
 * Escribe en el mismo `Input` que el teclado, así que el resto del juego
 * no necesita saber de dónde viene la orden.
 */
export function setupTouchControls(input: Input): void {
  const root = document.getElementById('touch-controls');
  const stick = document.getElementById('touch-stick');
  const knob = document.getElementById('touch-knob');
  if (!root || !stick || !knob) return;

  let pointerId: number | null = null;

  const updateStick = (event: PointerEvent): void => {
    const rect = stick.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const radius = rect.width / 2;
    let dx = event.clientX - cx;
    let dy = event.clientY - cy;
    const len = Math.hypot(dx, dy);
    if (len > radius) {
      dx = (dx / len) * radius;
      dy = (dy / len) * radius;
    }
    knob.style.transform = `translate(${dx}px, ${dy}px)`;
    const nx = dx / radius;
    const ny = dy / radius;
    const dead = 0.12;
    input.setTouchVector(Math.abs(nx) < dead ? 0 : nx, Math.abs(ny) < dead ? 0 : -ny);
  };

  stick.addEventListener('pointerdown', (event) => {
    pointerId = event.pointerId;
    try {
      stick.setPointerCapture(event.pointerId);
    } catch {
      /* puntero sintético o ya liberado */
    }
    updateStick(event);
    event.preventDefault();
  });
  stick.addEventListener('pointermove', (event) => {
    if (pointerId !== event.pointerId) return;
    updateStick(event);
    event.preventDefault();
  });
  const releaseStick = (event: PointerEvent): void => {
    if (pointerId !== event.pointerId) return;
    pointerId = null;
    knob.style.transform = 'translate(0px, 0px)';
    input.setTouchVector(0, 0);
  };
  stick.addEventListener('pointerup', releaseStick);
  stick.addEventListener('pointercancel', releaseStick);

  for (const button of root.querySelectorAll<HTMLButtonElement>('.touch-face, .touch-extra button')) {
    // La acción puede cambiar con el contexto (B = hablar/menú o movimiento 2).
    let held: TouchAction | null = null;
    button.addEventListener('pointerdown', (event) => {
      const action = button.dataset.action as TouchAction | undefined;
      if (!action) return;
      try {
        button.setPointerCapture(event.pointerId);
      } catch {
        /* puntero sintético o ya liberado */
      }
      held = action;
      button.classList.add('active');
      input.pressAction(action);
      event.preventDefault();
    });
    const release = (): void => {
      if (!held) return;
      button.classList.remove('active');
      input.releaseAction(held);
      held = null;
    };
    button.addEventListener('pointerup', release);
    button.addEventListener('pointercancel', release);
    button.addEventListener('pointerleave', release);
  }

  // En móvil, evita que el navegador haga zoom o arrastre con dos dedos.
  root.addEventListener('contextmenu', (event) => event.preventDefault());
}
