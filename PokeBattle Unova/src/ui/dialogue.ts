import type { Input } from '../core/input';

const CHARS_PER_SECOND = 62;

export class DialogueUI {
  private root = document.getElementById('dialogue')!;
  private nameEl = document.getElementById('dialogue-name')!;
  private textEl = document.getElementById('dialogue-text')!;
  private nextEl = document.getElementById('dialogue-next')!;
  private choicesEl = document.getElementById('dialogue-choices')!;

  private full = '';
  private shown = 0;
  private typing = false;
  private waiting = false;
  private resolveSay: (() => void) | null = null;
  private resolveChoice: ((index: number) => void) | null = null;
  private choices: string[] = [];
  /** Evita que la misma pulsación que abre el diálogo lo salte entera. */
  private ignoreInputFrame = false;

  constructor() {
    // En móvil no hay tecla E: tocar la caja avanza el texto.
    this.root.addEventListener('pointerdown', (event) => {
      if (!this.isOpen) return;
      if ((event.target as HTMLElement).closest('.dialogue-choices')) return;
      event.preventDefault();
      this.advance();
    });
  }

  get isOpen(): boolean {
    return !this.root.classList.contains('hidden');
  }

  say(name: string, text: string): Promise<void> {
    this.close();
    this.root.classList.remove('hidden');
    this.nameEl.textContent = name;
    this.nameEl.style.display = name ? 'inline-block' : 'none';
    this.full = text;
    this.shown = 0;
    this.typing = true;
    this.waiting = false;
    this.textEl.textContent = '';
    this.choicesEl.classList.add('hidden');
    this.nextEl.style.display = 'none';
    this.ignoreInputFrame = true;
    document.body.classList.add('dialogue-open');

    return new Promise((resolve) => {
      this.resolveSay = resolve;
    });
  }

  choice(options: string[]): Promise<number> {
    this.choices = options;
    this.choicesEl.innerHTML = '';
    this.choicesEl.classList.remove('hidden');
    this.nextEl.style.display = 'none';

    return new Promise((resolve) => {
      this.resolveChoice = resolve;
      options.forEach((label, i) => {
        const btn = document.createElement('button');
        btn.textContent = `${i + 1}. ${label}`;
        btn.addEventListener('click', () => this.pick(i));
        this.choicesEl.appendChild(btn);
      });
    });
  }

  private pick(index: number): void {
    const resolve = this.resolveChoice;
    if (!resolve) return;
    this.resolveChoice = null;
    this.choicesEl.classList.add('hidden');
    this.choicesEl.innerHTML = '';
    this.choices = [];
    resolve(index);
  }

  update(dt: number, input: Input): void {
    if (!this.isOpen) return;
    const ignoreInput = this.ignoreInputFrame;
    this.ignoreInputFrame = false;

    if (this.typing) {
      this.shown = Math.min(this.full.length, this.shown + dt * CHARS_PER_SECOND);
      this.textEl.textContent = this.full.slice(0, Math.floor(this.shown));
      if (this.shown >= this.full.length) {
        this.typing = false;
        this.textEl.textContent = this.full;
        if (!this.resolveChoice) this.nextEl.style.display = 'block';
        this.waiting = true;
      }
    }

    if (this.resolveChoice) {
      if (ignoreInput) return;
      for (let i = 0; i < this.choices.length; i++) {
        if (input.wasPressed(`Digit${i + 1}`, `Numpad${i + 1}`)) {
          this.pick(i);
          return;
        }
      }
      return;
    }

    if (ignoreInput) return;

    if (input.wasPressed('KeyE', 'Enter', 'Space')) this.advance();
  }

  /** Completa el texto o pasa a la siguiente línea (tecla/saludo o toque). */
  private advance(): void {
    if (this.resolveChoice) return;
    if (this.typing) {
      this.shown = this.full.length;
      this.textEl.textContent = this.full;
      this.typing = false;
      this.nextEl.style.display = 'block';
      this.waiting = true;
      return;
    }
    if (!this.waiting) return;
    this.waiting = false;
    this.nextEl.style.display = 'none';
    const resolve = this.resolveSay;
    this.resolveSay = null;
    resolve?.();
  }

  close(): void {
    this.root.classList.add('hidden');
    document.body.classList.remove('dialogue-open');
    this.typing = false;
    this.waiting = false;
    // Resolver la espera evita que un guion quede colgado si se cierra a mitad.
    const say = this.resolveSay;
    this.resolveSay = null;
    this.resolveChoice = null;
    say?.();
  }
}
