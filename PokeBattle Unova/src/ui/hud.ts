import * as THREE from 'three';
import { CATEGORY_LABEL, RANGE_LABEL } from '../data/moves';
import { creaturePortrait } from '../data/creatureSprites';
import type { Combatant, MoveDef } from '../types';

/* ------------------------------------------------------------------ */
/* Toasts / objetivo / avisos                                          */
/* ------------------------------------------------------------------ */

const toastLayer = document.getElementById('toast-layer')!;
const objectiveBox = document.getElementById('objective')!;
const objectiveText = document.getElementById('objective-text')!;
const worldHud = document.getElementById('world-hud')!;
const battleHudRoot = document.getElementById('battle-hud')!;
const bannerEl = document.getElementById('battle-banner')!;

export function toast(text: string, ms = 2400): void {
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = text;
  toastLayer.appendChild(el);
  window.setTimeout(() => el.remove(), ms);
}

export function setObjective(text: string): void {
  objectiveText.textContent = text;
  objectiveBox.style.display = text ? 'flex' : 'none';
}

export function showWorldHud(visible: boolean): void {
  worldHud.classList.toggle('hidden', !visible);
  if (!visible) return;
}

export function showBattleHud(visible: boolean): void {
  battleHudRoot.classList.toggle('hidden', !visible);
}

export function banner(text: string, ms = 1300): void {
  bannerEl.textContent = text;
  bannerEl.classList.remove('hidden');
  window.setTimeout(() => bannerEl.classList.add('hidden'), ms);
}

export function flashScreen(): void {
  const stage = document.getElementById('stage')!;
  stage.classList.remove('flash');
  void stage.offsetWidth;
  stage.classList.add('flash');
  window.setTimeout(() => stage.classList.remove('flash'), 600);
}

/* ------------------------------------------------------------------ */
/* Números de daño flotantes                                           */
/* ------------------------------------------------------------------ */

interface Popup {
  el: HTMLDivElement;
  pos: THREE.Vector3;
  life: number;
}

export class PopupLayer {
  private layer = document.getElementById('popup-layer')!;
  private items: Popup[] = [];

  constructor(private camera: THREE.PerspectiveCamera) {}

  spawn(pos: THREE.Vector3, text: string, color = '#fff'): void {
    const el = document.createElement('div');
    el.className = 'dmg-popup';
    el.textContent = text;
    el.style.color = color;
    this.layer.appendChild(el);
    this.items.push({ el, pos: pos.clone(), life: 0.9 });
  }

  update(dt: number): void {
    const v = new THREE.Vector3();
    for (let i = this.items.length - 1; i >= 0; i--) {
      const item = this.items[i];
      item.life -= dt;
      if (item.life <= 0) {
        item.el.remove();
        this.items.splice(i, 1);
        continue;
      }
      v.copy(item.pos).project(this.camera);
      const x = (v.x * 0.5 + 0.5) * window.innerWidth;
      const y = (-v.y * 0.5 + 0.5) * window.innerHeight;
      item.el.style.left = `${x}px`;
      item.el.style.top = `${y}px`;
    }
  }

  clear(): void {
    for (const item of this.items) item.el.remove();
    this.items = [];
  }
}

/* ------------------------------------------------------------------ */
/* HUD de combate                                                      */
/* ------------------------------------------------------------------ */

export class BattleHUD {
  private enemyName = document.getElementById('enemy-name')!;
  private enemyLevel = document.getElementById('enemy-level')!;
  private enemyHp = document.getElementById('enemy-hp')!;
  private enemyGhost = document.getElementById('enemy-ghost')!;
  private enemyNum = document.getElementById('enemy-hp-num')!;
  private enemyPortrait = document.getElementById('enemy-portrait') as HTMLImageElement;
  private enemyBadges = document.getElementById('enemy-badges')!;
  private allyName = document.getElementById('ally-name')!;
  private allyLevel = document.getElementById('ally-level')!;
  private allyHp = document.getElementById('ally-hp')!;
  private allyGhost = document.getElementById('ally-ghost')!;
  private allyNum = document.getElementById('ally-hp-num')!;
  private allyPortrait = document.getElementById('ally-portrait') as HTMLImageElement;
  private allyBadges = document.getElementById('ally-badges')!;
  private allyEnergy = document.getElementById('ally-energy')!;
  private moveBar = document.getElementById('move-bar')!;

  private slots: { root: HTMLDivElement; cooldown: HTMLDivElement; cdNum: HTMLSpanElement }[] = [];
  private allyGhostPct = 1;
  private enemyGhostPct = 1;
  private lastAllyBadges = '';
  private lastEnemyBadges = '';

  setup(ally: Combatant, enemy: Combatant, moves: MoveDef[], keyLabels: string[] = []): void {
    this.enemyName.textContent = enemy.species.name;
    this.enemyLevel.textContent = `Lv.${enemy.level}`;
    this.allyName.textContent = ally.species.name;
    this.allyLevel.textContent = `Lv.${ally.level}`;

    this.setPortrait(this.enemyPortrait, creaturePortrait(enemy.species));
    this.setPortrait(this.allyPortrait, creaturePortrait(ally.species));
    this.allyGhostPct = 1;
    this.enemyGhostPct = 1;

    this.moveBar.innerHTML = '';
    this.slots = [];
    moves.forEach((move, i) => {
      const root = document.createElement('div');
      root.className = `move-slot type-${move.type}`;
      root.innerHTML = `
        <span class="key">${keyLabels[i] ?? i + 1}</span>
        <div class="name">${move.name}</div>
        <div class="meta">
          <span class="cat ${move.category}">${CATEGORY_LABEL[move.category]}</span>
          <span class="rng">${RANGE_LABEL[move.range]}</span>
        </div>
        <div class="type"><i class="type-dot"></i>${move.type}${move.power > 0 ? ` · ${move.power}` : ''}</div>
        <div class="cooldown"><span class="cd-num"></span></div>
      `;
      const cooldown = root.querySelector('.cooldown') as HTMLDivElement;
      const cdNum = root.querySelector('.cd-num') as HTMLSpanElement;
      this.moveBar.appendChild(root);
      this.slots.push({ root, cooldown, cdNum });
    });

    // En táctil, los botones A/B/X/Y muestran el nombre del movimiento.
    const touchActions = ['move1', 'move2', 'move3', 'move4'];
    for (let i = 0; i < touchActions.length; i++) {
      const caption = document.querySelector(`#touch-controls [data-action="${touchActions[i]}"] span`);
      if (!caption) continue;
      const move = moves[i];
      caption.textContent = move ? move.name.slice(0, 11) : `MOV ${i + 1}`;
    }
  }

  private setPortrait(img: HTMLImageElement, url: string): void {
    img.classList.remove('missing');
    img.src = url;
    img.onerror = () => img.classList.add('missing');
  }

  update(
    ally: Combatant,
    enemy: Combatant,
    energy: number,
    cooldowns: number[],
    maxCooldowns: number[],
    allyBadges: string[] = [],
    enemyBadges: string[] = [],
  ): void {
    const allyMax = maxHp(ally);
    const enemyMax = maxHp(enemy);
    const allyPct = Math.max(0, ally.hp / allyMax);
    const enemyPct = Math.max(0, enemy.hp / enemyMax);

    this.allyHp.style.width = `${allyPct * 100}%`;
    this.enemyHp.style.width = `${enemyPct * 100}%`;
    this.allyHp.style.background = hpColor(allyPct);
    this.enemyHp.style.background = hpColor(enemyPct);

    // Barra “fantasma” que se queda atrás al recibir daño.
    this.allyGhostPct += (Math.max(allyPct, this.allyGhostPct) - this.allyGhostPct) * 0.06;
    this.enemyGhostPct += (Math.max(enemyPct, this.enemyGhostPct) - this.enemyGhostPct) * 0.06;
    if (this.allyGhostPct < allyPct) this.allyGhostPct = allyPct;
    if (this.enemyGhostPct < enemyPct) this.enemyGhostPct = enemyPct;
    this.allyGhost.style.width = `${this.allyGhostPct * 100}%`;
    this.enemyGhost.style.width = `${this.enemyGhostPct * 100}%`;

    this.allyNum.textContent = `${Math.ceil(ally.hp)}/${allyMax}`;
    this.enemyNum.textContent = `${Math.ceil(enemy.hp)}/${enemyMax}`;
    this.allyEnergy.style.width = `${energy}%`;

    const allyBadgeText = allyBadges.join('|');
    if (allyBadgeText !== this.lastAllyBadges) {
      this.lastAllyBadges = allyBadgeText;
      this.allyBadges.innerHTML = allyBadges.map((b) => `<span class="badge">${b}</span>`).join('');
    }
    const enemyBadgeText = enemyBadges.join('|');
    if (enemyBadgeText !== this.lastEnemyBadges) {
      this.lastEnemyBadges = enemyBadgeText;
      this.enemyBadges.innerHTML = enemyBadges.map((b) => `<span class="badge">${b}</span>`).join('');
    }

    for (let i = 0; i < this.slots.length; i++) {
      const max = maxCooldowns[i] || 1;
      const ratio = Math.min(1, Math.max(0, cooldowns[i] / max));
      this.slots[i].cooldown.style.height = `${ratio * 100}%`;
      this.slots[i].cdNum.textContent = cooldowns[i] > 0.15 ? cooldowns[i].toFixed(1) : '';
      this.slots[i].root.classList.toggle('cooling', cooldowns[i] > 0.05);
    }
  }
}

function hpColor(pct: number): string {
  if (pct > 0.5) return 'linear-gradient(180deg, #86efac, #22c55e)';
  if (pct > 0.2) return 'linear-gradient(180deg, #fde68a, #eab308)';
  return 'linear-gradient(180deg, #fca5a5, #dc2626)';
}

function maxHp(c: Combatant): number {
  return Math.floor(c.species.base.hp * 1.6 + c.level * 3.5);
}
