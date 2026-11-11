import * as THREE from 'three';
import type { Input } from '../core/input';
import { MOVES, RANGE_UNITS, typeMultiplier } from '../data/moves';
import { computeDamage, createCombatant, maxHpOf } from '../data/species';
import { creatureTexture } from '../data/creatureSprites';
import type { BattleOutcome, BattleRequest, Combatant, MoveDef } from '../types';
import { animateCreature, createCreature, createPokeball, createRock, createTree, particleTexture, type CreatureRig } from '../world/models';
import { BattleHUD, banner, PopupLayer } from '../ui/hud';

const ARENA_RADIUS = 12;
const MAX_ENERGY = 100;
const ENERGY_REGEN = 17;
const FIGHTER_SCALE = 1.3;
const ALLY_Z = 1.9;
const ENEMY_Z = -5.8;

interface Fighter {
  combatant: Combatant;
  rig: CreatureRig;
  pos: THREE.Vector3;
  facing: number;
  cooldowns: number[];
  invuln: number;
  dodgeCooldown: number;
  dodgeTimer: number;
  dodgeDir: THREE.Vector3;
  slow: number;
  /** billboard con el sprite pixel art (si el archivo local existe) */
  sprite: THREE.Sprite | null;
  spriteHeight: number;
  spritePhase: number;
  spriteBack: boolean;
  spriteFrame: number;
  /** 0..1, se dispara al atacar para una embestida breve */
  lunge: number;
  lungeDir: THREE.Vector3;
  prevX: number;
  prevZ: number;
  shadow: THREE.Mesh;
  /** multiplicadores temporales por movimientos de estado */
  atkMod: number;
  defMod: number;
  atkModTimer: number;
  defModTimer: number;
  hitPop: number;
  alive: boolean;
}

interface Projectile {
  mesh: THREE.Mesh;
  dir: THREE.Vector3;
  speed: number;
  power: number;
  type: MoveDef['type'];
  from: 'ally' | 'enemy';
  radius: number;
  moveId: string;
  life: number;
}

interface Telegraph {
  mesh: THREE.Mesh;
  time: number;
  total: number;
  moveId: string;
  dir: THREE.Vector3;
}

export interface BattleOptions {
  ally: Combatant;
  request: BattleRequest;
  input: Input;
  onEnd: (outcome: BattleOutcome, ally: Combatant, enemy: Combatant | null, captured?: Combatant) => void;
}

export class Battle {
  scene = new THREE.Scene();
  camera: THREE.PerspectiveCamera;

  private ally: Fighter;
  private enemy: Fighter;
  private team: { speciesId: string; level: number }[];
  private teamIndex = 0;

  private projectiles: Projectile[] = [];
  private telegraphs: Telegraph[] = [];
  private effects: { mesh: THREE.Object3D; life: number; total: number; kind: 'burst' | 'ball' }[] = [];

  private energy = MAX_ENERGY;
  private elapsed = 0;
  private state: 'intro' | 'fight' | 'ending' = 'intro';
  private introTimer = 0.9;
  private endTimer = 0;
  private pendingOutcome: BattleOutcome | null = null;
  private finished = false;
  private shake = 0;
  private aiTimer = 0;
  private aiMode: 'approach' | 'strafe' | 'retreat' = 'approach';
  private strafeSign = 1;

  private ball: { group: THREE.Group; t: number; from: THREE.Vector3; to: THREE.Vector3; done: boolean } | null = null;
  private catchAttempted = false;
  private catchResult: 'none' | 'caught' | 'failed' = 'none';

  private hud = new BattleHUD();
  private disposables: THREE.BufferGeometry[] = [];
  private clouds: THREE.Object3D[] = [];
  private leaves: THREE.Points | null = null;
  popups: PopupLayer;

  constructor(private opts: BattleOptions) {
    this.camera = new THREE.PerspectiveCamera(56, 1, 0.1, 200);
    this.camera.position.set(0, 11, 15.5);
    this.camera.lookAt(0, 0.9, -1.5);
    this.popups = new PopupLayer(this.camera);

    this.team = opts.request.team;
    this.teamIndex = 0;

    this.buildArena();
    this.ally = this.createFighter(opts.ally, new THREE.Vector3(0, 0, ALLY_Z), 0);
    this.enemy = this.createFighter(
      createCombatant(this.team[0].speciesId, this.team[0].level),
      new THREE.Vector3(0, 0, ENEMY_Z),
      Math.PI,
    );

    const labels = [0, 1, 2, 3].map((i) => opts.input.label(`move${i + 1}` as 'move1'));
    this.hud.setup(this.ally.combatant, this.enemy.combatant, this.allyMoves(), labels);
    this.attachSprites();
    banner(opts.request.kind === 'wild' ? `¡${this.enemy.combatant.species.name} salvaje!` : `¡${opts.request.trainerName ?? 'Entrenador'} te desafía!`);
  }

  resize(aspect: number): void {
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
  }

  /* ---------------------------------------------------------------- */

  private allyMoves(): MoveDef[] {
    return this.ally.combatant.moves
      .map((id) => MOVES[id])
      .filter((m): m is MoveDef => Boolean(m));
  }

  /** Sprite pixel art generado por código (estilo overworld), no PNG oficial. */
  private attachSprites(): void {
    this.attachSprite(this.ally, true);
    this.attachSprite(this.enemy, false);
  }

  private attachSprite(f: Fighter, back: boolean): void {
    const texture = creatureTexture(f.combatant.species, back, 0);
    const material = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      alphaTest: 0.05,
      depthWrite: false,
    });
    const sprite = new THREE.Sprite(material);
    const height = 3.8 * f.combatant.species.size;
    sprite.scale.set(height, height, 1);
    sprite.position.set(f.pos.x, height * 0.5, f.pos.z);
    this.scene.add(sprite);
    f.sprite = sprite;
    f.spriteHeight = height;
    f.spriteBack = back;
    f.spriteFrame = 0;
    f.rig.visible = false;
  }

  private buildArena(): void {
    const sky = 0x4a6390;
    this.scene.background = new THREE.Color(sky);
    this.scene.fog = new THREE.Fog(sky, 40, 88);

    const hemi = new THREE.HemisphereLight(0xcfe6ff, 0x24332a, 1.2);
    this.scene.add(hemi);

    const key = new THREE.DirectionalLight(0xfff3d6, 2.0);
    key.position.set(10, 20, 12);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.left = -22;
    key.shadow.camera.right = 22;
    key.shadow.camera.top = 22;
    key.shadow.camera.bottom = -22;
    key.shadow.bias = -0.001;
    this.scene.add(key);

    const rim = new THREE.DirectionalLight(0x6fb3ff, 1.0);
    rim.position.set(-14, 8, -16);
    this.scene.add(rim);

    const floorGeo = new THREE.CircleGeometry(ARENA_RADIUS + 3, 48);
    floorGeo.rotateX(-Math.PI / 2);
    const floor = new THREE.Mesh(
      floorGeo,
      new THREE.MeshStandardMaterial({ color: 0x37503a, roughness: 1 }),
    );
    floor.receiveShadow = true;
    this.scene.add(floor);
    this.disposables.push(floorGeo);

    const innerGeo = new THREE.CircleGeometry(ARENA_RADIUS, 48);
    innerGeo.rotateX(-Math.PI / 2);
    const inner = new THREE.Mesh(
      innerGeo,
      new THREE.MeshStandardMaterial({ color: 0x4a6b4c, roughness: 1 }),
    );
    inner.position.y = 0.02;
    inner.receiveShadow = true;
    this.scene.add(inner);
    this.disposables.push(innerGeo);

    const ringGeo = new THREE.TorusGeometry(ARENA_RADIUS, 0.22, 8, 64);
    ringGeo.rotateX(Math.PI / 2);
    const ring = new THREE.Mesh(
      ringGeo,
      new THREE.MeshStandardMaterial({ color: 0xffd447, emissive: 0x8a6a00, emissiveIntensity: 0.6 }),
    );
    ring.position.y = 0.06;
    this.scene.add(ring);
    this.disposables.push(ringGeo);

    for (let i = 0; i < 18; i++) {
      const angle = (i / 18) * Math.PI * 2;
      const radius = ARENA_RADIUS + 4 + Math.random() * 4;
      const prop = Math.random() > 0.45 ? createTree(i % 3) : createRock();
      prop.position.set(Math.cos(angle) * radius, 0, Math.sin(angle) * radius);
      prop.scale.setScalar(0.9 + Math.random() * 0.8);
      this.scene.add(prop);
    }

    // centro de la arena: emblema tipo Poké Ball
    const emblemGeo = new THREE.CircleGeometry(2.1, 40);
    emblemGeo.rotateX(-Math.PI / 2);
    const emblem = new THREE.Mesh(
      emblemGeo,
      new THREE.MeshBasicMaterial({ color: 0xe9edf5, transparent: true, opacity: 0.32 }),
    );
    emblem.position.y = 0.041;
    this.scene.add(emblem);
    this.disposables.push(emblemGeo);

    const halfGeo = new THREE.CircleGeometry(2.1, 40, 0, Math.PI);
    halfGeo.rotateX(-Math.PI / 2);
    halfGeo.rotateY(-Math.PI / 2);
    const half = new THREE.Mesh(
      halfGeo,
      new THREE.MeshBasicMaterial({ color: 0xd64545, transparent: true, opacity: 0.36 }),
    );
    half.position.y = 0.042;
    this.scene.add(half);
    this.disposables.push(halfGeo);

    const bandGeo = new THREE.RingGeometry(2.05, 2.25, 48);
    bandGeo.rotateX(-Math.PI / 2);
    const band = new THREE.Mesh(
      bandGeo,
      new THREE.MeshBasicMaterial({ color: 0x111827, transparent: true, opacity: 0.35 }),
    );
    band.position.y = 0.043;
    this.scene.add(band);
    this.disposables.push(bandGeo);

    // hierba, flores y piedras sueltas
    const tuftGeo = new THREE.ConeGeometry(0.075, 0.42, 5);
    const tuftMat = new THREE.MeshStandardMaterial({ color: 0x3d7a47, roughness: 1 });
    const tufts = new THREE.InstancedMesh(tuftGeo, tuftMat, 220);
    const dummy = new THREE.Object3D();
    for (let i = 0; i < 220; i++) {
      const angle = Math.random() * Math.PI * 2;
      const radius = 2.9 + Math.random() * (ARENA_RADIUS - 2.4);
      dummy.position.set(Math.cos(angle) * radius, 0.18, Math.sin(angle) * radius);
      dummy.rotation.set(0, Math.random() * Math.PI, (Math.random() - 0.5) * 0.3);
      dummy.scale.setScalar(0.7 + Math.random() * 0.8);
      dummy.updateMatrix();
      tufts.setMatrixAt(i, dummy.matrix);
    }
    this.scene.add(tufts);
    this.disposables.push(tuftGeo);

    const flowerColors = [0xffe066, 0xff8fab, 0xffffff, 0xb28dff];
    for (let i = 0; i < 26; i++) {
      const angle = Math.random() * Math.PI * 2;
      const radius = 3.4 + Math.random() * (ARENA_RADIUS - 3);
      const flower = new THREE.Group();
      const stem = new THREE.Mesh(
        new THREE.CylinderGeometry(0.02, 0.025, 0.26, 4),
        new THREE.MeshStandardMaterial({ color: 0x3f6f3a, roughness: 1 }),
      );
      stem.position.y = 0.13;
      const petal = new THREE.Mesh(
        new THREE.SphereGeometry(0.07, 6, 5),
        new THREE.MeshStandardMaterial({ color: flowerColors[i % flowerColors.length], roughness: 0.8 }),
      );
      petal.scale.y = 0.6;
      petal.position.y = 0.28;
      flower.add(stem, petal);
      flower.position.set(Math.cos(angle) * radius, 0, Math.sin(angle) * radius);
      this.scene.add(flower);
    }

    // banderines alrededor del campo
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2 + Math.PI / 8;
      const pole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.06, 0.08, 2.6, 6),
        new THREE.MeshStandardMaterial({ color: 0xd8dee9, roughness: 0.6 }),
      );
      pole.position.set(Math.cos(angle) * (ARENA_RADIUS + 1.6), 1.3, Math.sin(angle) * (ARENA_RADIUS + 1.6));
      pole.castShadow = true;
      this.scene.add(pole);
      const flag = new THREE.Mesh(
        new THREE.PlaneGeometry(0.9, 0.5),
        new THREE.MeshBasicMaterial({
          color: i % 2 === 0 ? 0xffd447 : 0x55d6ff,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.9,
        }),
      );
      flag.position.copy(pole.position).add(new THREE.Vector3(Math.cos(angle + Math.PI / 2) * 0.45, 0.9, Math.sin(angle + Math.PI / 2) * 0.45));
      flag.lookAt(0, 1.6, 0);
      this.scene.add(flag);
    }

    // cielo degradado de amanecer
    const skyGeo = new THREE.SphereGeometry(95, 24, 14);
    const skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        top: { value: new THREE.Color(0x18294a) },
        mid: { value: new THREE.Color(0x6987b8) },
        bottom: { value: new THREE.Color(0xf3b98a) },
      },
      vertexShader: 'varying float h; void main(){ h = normalize(position).y; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader:
        'uniform vec3 top; uniform vec3 mid; uniform vec3 bottom; varying float h; void main(){ float t = clamp(h * 0.5 + 0.5, 0.0, 1.0); vec3 c = t < 0.5 ? mix(bottom, mid, t * 2.0) : mix(mid, top, (t - 0.5) * 2.0); gl_FragColor = vec4(c, 1.0); }',
    });
    this.scene.add(new THREE.Mesh(skyGeo, skyMat));
    this.disposables.push(skyGeo);

    // nubes
    for (let i = 0; i < 7; i++) {
      const cloud = new THREE.Group();
      const puffs = 3 + (i % 3);
      for (let p = 0; p < puffs; p++) {
        const puff = new THREE.Mesh(
          new THREE.SphereGeometry(2 + Math.random() * 1.8, 8, 6),
          new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.32, depthWrite: false }),
        );
        puff.position.set(p * 2.1 - puffs, Math.random() * 0.8, Math.random() * 1.6 - 0.8);
        puff.scale.y = 0.55;
        cloud.add(puff);
      }
      const angle = (i / 7) * Math.PI * 2;
      cloud.position.set(Math.cos(angle) * 46, 19 + (i % 3) * 3, Math.sin(angle) * 46 - 8);
      this.scene.add(cloud);
      this.clouds.push(cloud);
    }

    // motas de polen flotando
    const leafGeo = new THREE.BufferGeometry();
    const count = 90;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 34;
      positions[i * 3 + 1] = Math.random() * 6 + 0.4;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 30;
    }
    leafGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const leafMat = new THREE.PointsMaterial({
      color: 0xfff1c2,
      size: 0.16,
      map: particleTexture(),
      transparent: true,
      opacity: 0.7,
      depthWrite: false,
    });
    this.leaves = new THREE.Points(leafGeo, leafMat);
    this.scene.add(this.leaves);
    this.disposables.push(leafGeo);
  }

  private createFighter(combatant: Combatant, pos: THREE.Vector3, facing: number): Fighter {
    const rig = createCreature(combatant.species);
    rig.position.copy(pos);
    rig.rotation.y = facing;
    rig.scale.setScalar(FIGHTER_SCALE);
    this.scene.add(rig);

    // Sombra de contacto: ancla visualmente la criatura al suelo.
    const shadowGeo = new THREE.CircleGeometry(0.82 * combatant.species.size, 24);
    shadowGeo.rotateX(-Math.PI / 2);
    const shadow = new THREE.Mesh(
      shadowGeo,
      new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.26, depthWrite: false }),
    );
    shadow.position.set(pos.x, 0.035, pos.z);
    shadow.scale.set(1, 1, 0.72);
    this.scene.add(shadow);
    this.disposables.push(shadowGeo);
    return {
      combatant,
      rig,
      pos: pos.clone(),
      facing,
      cooldowns: combatant.moves.map(() => 0),
      invuln: 0,
      dodgeCooldown: 0,
      dodgeTimer: 0,
      dodgeDir: new THREE.Vector3(),
      slow: 0,
      sprite: null,
      spriteHeight: 0,
      spritePhase: Math.random() * Math.PI * 2,
      spriteBack: false,
      spriteFrame: 0,
      lunge: 0,
      lungeDir: new THREE.Vector3(0, 0, -1),
      prevX: pos.x,
      prevZ: pos.z,
      shadow,
      atkMod: 1,
      defMod: 1,
      atkModTimer: 0,
      defModTimer: 0,
      hitPop: 0,
      alive: true,
    };
  }

  /* ---------------------------------------------------------------- */

  update(dt: number): void {
    if (this.finished) return;
    this.elapsed += dt;
    this.popups.update(dt);
    this.shake = Math.max(0, this.shake - dt * 2.6);
    this.updateAmbient(dt);

    if (this.state === 'intro') {
      this.introTimer -= dt;
      if (this.introTimer <= 0) this.state = 'fight';
      this.animateHud(dt);
      this.updateCamera(dt);
      return;
    }

    if (this.state === 'ending') {
      this.endTimer -= dt;
      this.updateProjectiles(dt);
      this.updateEffects(dt);
      this.animateHud(dt);
      this.updateCamera(dt);
      if (this.endTimer <= 0) this.finish();
      return;
    }

    this.updatePlayer(dt);
    this.updateEnemy(dt);
    this.updateProjectiles(dt);
    this.updateTelegraphs(dt);
    this.updateBall(dt);
    this.updateEffects(dt);

    for (const f of [this.ally, this.enemy]) {
      f.cooldowns = f.cooldowns.map((c) => Math.max(0, c - dt));
      f.invuln = Math.max(0, f.invuln - dt);
      f.dodgeCooldown = Math.max(0, f.dodgeCooldown - dt);
      f.slow = Math.max(0, f.slow - dt);
      f.atkModTimer = Math.max(0, f.atkModTimer - dt);
      f.defModTimer = Math.max(0, f.defModTimer - dt);
      if (f.atkModTimer === 0) f.atkMod = 1;
      if (f.defModTimer === 0) f.defMod = 1;
      f.hitPop = Math.max(0, f.hitPop - dt * 4);
      const scale = FIGHTER_SCALE * (1 + f.hitPop * 0.12);
      f.rig.scale.setScalar(scale);
      if (f.sprite) {
        // Movimiento real del combatiente en este frame (para el ciclo de paso).
        const moved = Math.hypot(f.rig.position.x - f.prevX, f.rig.position.z - f.prevZ);
        const speed = moved / Math.max(dt, 0.0001);
        f.prevX = f.rig.position.x;
        f.prevZ = f.rig.position.z;
        const moving = speed > 0.35;
        f.spritePhase += dt * (moving ? 11 : 2.6);
        f.lunge = Math.max(0, f.lunge - dt * 3.6);

        const lungeP = f.lunge * f.lunge;
        const bob = Math.sin(f.spritePhase) * (moving ? 0.17 : 0.085);
        const breathe = Math.sin(f.spritePhase * 0.55) * 0.032;
        const base = f.spriteHeight;
        const w = base * (1 + breathe + f.hitPop * 0.08) * (1 - lungeP * 0.05);
        const h = base * (1 - breathe * 0.8 + f.hitPop * 0.12) * (1 + lungeP * 0.08);
        f.sprite.scale.set(w, h, 1);

        const shake = Math.sin(this.elapsed * 70) * 0.13 * f.hitPop;
        f.sprite.position.set(
          f.rig.position.x + f.lungeDir.x * lungeP * 1.05 + shake,
          f.spriteHeight * 0.5 + f.rig.position.y + bob,
          f.rig.position.z + f.lungeDir.z * lungeP * 1.05,
        );
        // Cambio de fotograma al caminar (dos poses de patas/alas).
        const nextFrame = moving ? Math.floor(f.spritePhase / Math.PI) % 2 : 0;
        if (nextFrame !== f.spriteFrame) {
          f.spriteFrame = nextFrame;
          (f.sprite.material as THREE.SpriteMaterial).map = creatureTexture(
            f.combatant.species,
            f.spriteBack,
            nextFrame,
          );
          (f.sprite.material as THREE.SpriteMaterial).needsUpdate = true;
        }
        const mat = f.sprite.material as THREE.SpriteMaterial;
        mat.rotation = Math.sin(f.spritePhase) * (moving ? 0.05 : 0.025);
        const flash = Math.min(1, f.hitPop * 2.2);
        mat.color.setRGB(1, 1 - flash * 0.65, 1 - flash * 0.65);
      }
      f.shadow.position.set(f.rig.position.x, 0.035, f.rig.position.z);
      const shadowScale = (f.alive ? 1 : 1.15) * (1 + f.hitPop * 0.08);
      f.shadow.scale.set(shadowScale, 1, shadowScale * 0.72);
    }

    this.energy = Math.min(MAX_ENERGY, this.energy + ENERGY_REGEN * dt);
    this.animateHud(dt);
    this.updateCamera(dt);

    if (this.enemy.combatant.hp <= 0 && this.enemy.alive) this.onEnemyDefeated();
    if (this.ally.combatant.hp <= 0 && this.ally.alive) this.onAllyDefeated();
  }

  private updateAmbient(dt: number): void {
    for (let i = 0; i < this.clouds.length; i++) {
      const cloud = this.clouds[i];
      cloud.position.x += dt * (0.35 + i * 0.03);
      if (cloud.position.x > 56) cloud.position.x = -56;
    }
    if (this.leaves) {
      this.leaves.rotation.y += dt * 0.045;
      const pos = this.leaves.geometry.getAttribute('position') as THREE.BufferAttribute;
      for (let i = 0; i < pos.count; i++) {
        const y = pos.getY(i) + dt * 0.18;
        pos.setY(i, y > 6.4 ? 0.4 : y);
      }
      pos.needsUpdate = true;
    }
  }

  private animateHud(_dt: number): void {
    const moves = this.allyMoves();
    this.hud.update(
      this.ally.combatant,
      this.enemy.combatant,
      this.energy,
      this.ally.cooldowns,
      moves.map((m) => m.cooldown),
      statusBadges(this.ally),
      statusBadges(this.enemy),
    );
  }

  private updateCamera(dt: number): void {
    const shakeX = this.shake > 0 ? (Math.random() - 0.5) * this.shake * 0.9 : 0;
    const shakeY = this.shake > 0 ? (Math.random() - 0.5) * this.shake * 0.9 : 0;
    const desiredX = this.ally.pos.x * 0.25;
    this.camera.position.x += (desiredX + shakeX - this.camera.position.x) * Math.min(1, dt * 4);
    this.camera.position.y = 11 + shakeY;
    this.camera.position.z = 15.5;
    this.camera.lookAt(0, 0.9, -1.5);
  }

  /* ---------------------------------------------------------------- */
  /* Jugador                                                          */
  /* ---------------------------------------------------------------- */

  private updatePlayer(dt: number): void {
    if (this.ball) return;
    const f = this.ally;
    const mv = this.opts.input.moveVector();
    const sprint = this.opts.input.isDown('ShiftLeft', 'ShiftRight');
    let speed = sprint ? 8.4 : 6.2;
    if (f.slow > 0) speed *= 0.62;

    if (f.dodgeTimer > 0) {
      f.dodgeTimer -= dt;
      const dodgeSpeed = 22;
      f.pos.addScaledVector(f.dodgeDir, dodgeSpeed * dt);
    } else if (mv.x !== 0 || mv.y !== 0) {
      const dir = new THREE.Vector3(mv.x, 0, -mv.y).normalize();
      f.pos.addScaledVector(dir, speed * dt);
      f.facing = Math.atan2(dir.x, dir.z);
      f.rig.rotation.y = f.facing;
    }

    // esquiva
    if (
      f.dodgeCooldown <= 0 &&
      this.opts.input.wasPressed('Space') &&
      this.energy >= 18 &&
      f.dodgeTimer <= 0
    ) {
      const dir = mv.x !== 0 || mv.y !== 0 ? new THREE.Vector3(mv.x, 0, -mv.y).normalize() : new THREE.Vector3(0, 0, -1);
      f.dodgeDir.copy(dir);
      f.dodgeTimer = 0.18;
      f.dodgeCooldown = 1.5;
      f.invuln = 0.36;
      this.energy -= 18;
      this.spawnBurst(f.pos, new THREE.Vector3(0, 0.6, 0), 0x7dd3fc, 1.1);
    }

    // límites de arena
    const dist = Math.hypot(f.pos.x, f.pos.z);
    if (dist > ARENA_RADIUS) {
      f.pos.multiplyScalar(ARENA_RADIUS / dist);
    }

    f.rig.position.set(f.pos.x, 0, f.pos.z);
    animateCreature(f.rig, this.elapsed, f.dodgeTimer > 0 || mv.x !== 0 || mv.y !== 0);

    // ataques
    const moves = this.allyMoves();
    for (let i = 0; i < moves.length; i++) {
      if (this.opts.input.wasPressed(`Digit${i + 1}`, `Numpad${i + 1}`)) {
        this.tryCast(f, this.enemy, moves[i], i, 'ally');
      }
    }

    // captura
    if (
      this.opts.request.canCatch &&
      !this.catchAttempted &&
      this.opts.input.wasPressed('KeyC') &&
      this.enemy.combatant.hp > 0
    ) {
      this.throwBall();
    }
  }

  private tryCast(from: Fighter, to: Fighter, move: MoveDef, slot: number, side: 'ally' | 'enemy'): string | null {
    if (from.cooldowns[slot] > 0) return 'cooldown';

    const selfStatus = move.category === 'status' && (move.effect === 'heal' || move.effect === 'defense_up');
    const dist = Math.hypot(to.pos.x - from.pos.x, to.pos.z - from.pos.z);
    if (!selfStatus && dist > RANGE_UNITS[move.range] + 0.6) {
      if (side === 'ally') {
        this.popups.spawn(
          from.pos.clone().add(new THREE.Vector3(0, 1.9, 0)),
          'Fuera de alcance',
          '#fca5a5',
        );
      }
      return 'range';
    }

    if (side === 'ally') {
      if (this.energy < move.energy) return 'energy';
      this.energy -= move.energy;
    }
    from.cooldowns[slot] = move.cooldown;
    from.lunge = 1;
    from.lungeDir.set(to.pos.x - from.pos.x, 0, to.pos.z - from.pos.z).normalize();

    if (move.category === 'status') {
      this.applyStatus(from, to, move);
      return null;
    }

    const origin = from.pos.clone().add(new THREE.Vector3(0, 0.9, 0));
    const target = to.pos.clone().add(new THREE.Vector3(0, 0.9, 0));
    const dir = target.clone().sub(origin).normalize();

    const geo = new THREE.SphereGeometry(move.radius, 14, 10);
    const mesh = new THREE.Mesh(
      geo,
      new THREE.MeshStandardMaterial({
        color: move.color,
        emissive: move.color,
        emissiveIntensity: 0.75,
        roughness: 0.35,
      }),
    );
    mesh.position.copy(origin);
    mesh.castShadow = true;
    this.scene.add(mesh);
    this.disposables.push(geo);

    this.projectiles.push({
      mesh,
      dir,
      speed: move.speed,
      power: move.power,
      type: move.type,
      from: side,
      radius: move.radius,
      moveId: move.id,
      life: (RANGE_UNITS[move.range] + 2.5) / Math.max(1, move.speed),
    });

    this.spawnBurst(origin, dir, move.color, 0.9);
    return null;
  }

  /** Movimientos de estado: se resuelven al instante, sin proyectil. */
  private applyStatus(from: Fighter, to: Fighter, move: MoveDef): void {
    const value = move.effectValue ?? 1;
    const at = from.pos.clone().add(new THREE.Vector3(0, 1.9, 0));
    switch (move.effect) {
      case 'heal': {
        const max = maxHpOf(from.combatant);
        const heal = Math.round(max * value);
        from.combatant.hp = Math.min(max, from.combatant.hp + heal);
        this.popups.spawn(at, `+${heal}`, '#4ade80');
        break;
      }
      case 'defense_up':
        from.defMod = value;
        from.defModTimer = 6;
        this.popups.spawn(at, 'DEF ↑', '#7dd3fc');
        break;
      case 'attack_down':
        to.atkMod = value;
        to.atkModTimer = 6;
        this.popups.spawn(to.pos.clone().add(new THREE.Vector3(0, 1.9, 0)), 'ATQ ↓', '#fca5a5');
        break;
      case 'slow':
        to.slow = value;
        this.popups.spawn(to.pos.clone().add(new THREE.Vector3(0, 1.9, 0)), 'Lento', '#c4b5fd');
        break;
      default:
        break;
    }
    this.spawnBurst(
      from.pos.clone().add(new THREE.Vector3(0, 0.5, 0)),
      new THREE.Vector3(0, 1, 0),
      move.color,
      1.1,
    );
  }

  private throwBall(): void {
    this.catchAttempted = true;
    const group = createPokeball();
    group.position.copy(this.ally.pos).add(new THREE.Vector3(0, 1, 0));
    this.scene.add(group);
    this.ball = {
      group,
      t: 0,
      from: group.position.clone(),
      to: this.enemy.pos.clone().add(new THREE.Vector3(0, 0.8, 0)),
      done: false,
    };
  }

  private updateBall(dt: number): void {
    if (!this.ball) return;
    const ball = this.ball;
    if (!ball.done) {
      ball.t += dt / 0.62;
      const t = Math.min(1, ball.t);
      const pos = ball.from.clone().lerp(ball.to, t);
      pos.y += Math.sin(t * Math.PI) * 3.2;
      ball.group.position.copy(pos);
      ball.group.rotation.x += dt * 14;
      if (t >= 1) {
        ball.done = true;
        ball.t = 0;
        const maxHp = maxHpOf(this.enemy.combatant);
        const hpRatio = Math.max(0, this.enemy.combatant.hp / maxHp);
        const chance = 0.12 + (1 - hpRatio) * 0.72;
        this.catchResult = Math.random() < chance ? 'caught' : 'failed';
        banner('···', 1400);
      }
      return;
    }

    ball.t += dt;
    ball.group.position.y = 0.8 + Math.sin(ball.t * 8) * 0.08;
    if (ball.t > 1.4) {
      this.scene.remove(ball.group);
      this.ball = null;
      this.enemy.rig.visible = true;
      if (this.catchResult === 'caught') {
        banner('¡Capturado!', 1200);
        this.pendingOutcome = 'caught';
        this.state = 'ending';
        this.endTimer = 1.1;
        this.popups.clear();
      } else {
        banner('¡Se ha escapado!', 1000);
        this.enemy.combatant.hp = Math.max(1, this.enemy.combatant.hp);
      }
    } else if (ball.t > 0.25) {
      this.enemy.rig.visible = false;
    }
  }

  /* ---------------------------------------------------------------- */
  /* Enemigo                                                          */
  /* ---------------------------------------------------------------- */

  private updateEnemy(dt: number): void {
    if (this.ball || this.state !== 'fight') return;
    const f = this.enemy;
    const player = this.ally;
    const toPlayer = player.pos.clone().sub(f.pos);
    const dist = toPlayer.length();
    const dir = toPlayer.clone().normalize();

    // mirar al jugador
    f.facing = Math.atan2(dir.x, dir.z);
    f.rig.rotation.y = f.facing;

    const moves = f.combatant.moves.map((id) => MOVES[id]).filter(Boolean);
    const hasTelegraph = this.telegraphs.some((t) => t.moveId.startsWith('enemy:'));
    let moving = false;

    if (!hasTelegraph) {
      this.aiTimer -= dt;
      if (this.aiTimer <= 0) {
        this.aiTimer = 1.4 + Math.random() * 1.6;
        this.aiMode = dist > 10 ? 'approach' : dist < 4.5 ? 'retreat' : Math.random() > 0.5 ? 'strafe' : 'approach';
        this.strafeSign = Math.random() > 0.5 ? 1 : -1;
      }

      const speed = (f.slow > 0 ? 2.6 : 4.6) * (this.opts.request.trainerName ? 1.12 : 1);
      if (this.aiMode === 'approach' && dist > 5) {
        f.pos.addScaledVector(dir, speed * dt);
        moving = true;
      } else if (this.aiMode === 'retreat' && dist < 5.5) {
        f.pos.addScaledVector(dir, -speed * 0.8 * dt);
        moving = true;
      } else if (this.aiMode === 'strafe') {
        const side = new THREE.Vector3(-dir.z, 0, dir.x).multiplyScalar(this.strafeSign);
        f.pos.addScaledVector(side, speed * 0.85 * dt);
        moving = true;
      }

      // atacar (sólo con movimientos a alcance)
      const readySlots = moves
        .map((move, index) => ({ move, index }))
        .filter(
          ({ move, index }) =>
            f.cooldowns[index] <= 0 &&
            (move.category === 'status' && (move.effect === 'heal' || move.effect === 'defense_up')
              ? true
              : dist <= RANGE_UNITS[move.range] + 0.6),
        );
      if (readySlots.length > 0 && Math.random() < dt * 0.7) {
        const pick = readySlots[Math.floor(Math.random() * readySlots.length)];
        this.startTelegraph(f, player, pick.move, pick.index);
      }
    }

    const limit = Math.hypot(f.pos.x, f.pos.z);
    if (limit > ARENA_RADIUS) f.pos.multiplyScalar(ARENA_RADIUS / limit);

    f.rig.position.set(f.pos.x, 0, f.pos.z);
    animateCreature(f.rig, this.elapsed, moving);
  }

  private startTelegraph(from: Fighter, to: Fighter, move: MoveDef, slot: number): void {
    const ringGeo = new THREE.RingGeometry(0.2, 0.55, 24);
    ringGeo.rotateX(-Math.PI / 2);
    const mesh = new THREE.Mesh(
      ringGeo,
      new THREE.MeshBasicMaterial({
        color: move.color,
        transparent: true,
        opacity: 0.85,
        side: THREE.DoubleSide,
      }),
    );
    mesh.position.copy(from.pos).add(new THREE.Vector3(0, 0.08, 0));
    this.scene.add(mesh);
    this.disposables.push(ringGeo);

    const dir = to.pos.clone().add(new THREE.Vector3(0, 0.9, 0)).sub(from.pos.clone().add(new THREE.Vector3(0, 0.9, 0))).normalize();
    this.telegraphs.push({
      mesh,
      time: 0,
      total: 0.62,
      moveId: `enemy:${slot}`,
      dir,
    });
  }

  private updateTelegraphs(dt: number): void {
    for (let i = this.telegraphs.length - 1; i >= 0; i--) {
      const t = this.telegraphs[i];
      t.time += dt;
      const p = Math.min(1, t.time / t.total);
      t.mesh.scale.setScalar(0.6 + p * 5.5);
      (t.mesh.material as THREE.MeshBasicMaterial).opacity = 0.85 - p * 0.55;
      t.mesh.position.set(this.enemy.pos.x, 0.08, this.enemy.pos.z);

      if (p >= 1) {
        this.scene.remove(t.mesh);
        this.telegraphs.splice(i, 1);
        const slot = Number(t.moveId.split(':')[1]);
        const move = MOVES[this.enemy.combatant.moves[slot]];
        if (move) this.tryCast(this.enemy, this.ally, move, slot, 'enemy');
      }
    }
  }

  /* ---------------------------------------------------------------- */
  /* Proyectiles                                                      */
  /* ---------------------------------------------------------------- */

  private updateProjectiles(dt: number): void {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.life -= dt;
      p.mesh.position.addScaledVector(p.dir, p.speed * dt);
      p.mesh.rotation.x += dt * 6;

      const target = p.from === 'ally' ? this.enemy : this.ally;
      const hitDist = 0.75 + p.radius;
      const d = p.mesh.position.distanceTo(
        new THREE.Vector3(target.pos.x, 0.9, target.pos.z),
      );

      if (d < hitDist) {
        this.hit(target, p);
        this.scene.remove(p.mesh);
        this.projectiles.splice(i, 1);
        continue;
      }

      if (p.life <= 0) {
        this.spawnBurst(p.mesh.position, p.dir, 0xffffff, 0.5);
        this.scene.remove(p.mesh);
        this.projectiles.splice(i, 1);
      }
    }
  }

  private hit(target: Fighter, projectile: Projectile): void {
    if (target.invuln > 0) {
      this.popups.spawn(target.pos.clone().add(new THREE.Vector3(0, 1.6, 0)), '¡Esquivado!', '#7dd3fc');
      return;
    }

    const attackerFighter = projectile.from === 'ally' ? this.ally : this.enemy;
    const attacker = attackerFighter.combatant;
    const defender = target.combatant;
    const mult = typeMultiplier(projectile.type, defender.species.types);
    const damage = computeDamage(
      attacker,
      defender,
      projectile.moveId,
      mult,
      attackerFighter.atkMod,
      target.defMod,
    );

    defender.hp = Math.max(0, defender.hp - damage);
    target.hitPop = 1;
    target.invuln = 0.12;

    const color = mult > 1.4 ? '#ffd447' : mult < 0.9 ? '#94a3b8' : '#ffffff';
    this.popups.spawn(
      new THREE.Vector3(target.pos.x, 1.9, target.pos.z),
      `${damage}${mult > 1.4 ? ' ¡x2!' : ''}`,
      color,
    );
    this.spawnBurst(new THREE.Vector3(target.pos.x, 1, target.pos.z), new THREE.Vector3(0, 1, 0), 0xffffff, 1.2);

    const move = MOVES[projectile.moveId];
    if (move?.effect === 'drain') {
      const heal = Math.round(damage * (move.effectValue ?? 0.4));
      attacker.hp = Math.min(maxHpOf(attacker), attacker.hp + heal);
      this.popups.spawn(
        attackerFighter.pos.clone().add(new THREE.Vector3(0, 1.9, 0)),
        `+${heal}`,
        '#4ade80',
      );
    }
    if (move?.effect === 'slow') {
      target.slow = move.effectValue ?? 2.5;
    }
    if (move?.effect === 'attack_down') {
      target.atkMod = move.effectValue ?? 0.75;
      target.atkModTimer = 6;
    }
    if (projectile.from === 'enemy') {
      this.shake = 1;
    }
  }

  /* ---------------------------------------------------------------- */
  /* Efectos                                                          */
  /* ---------------------------------------------------------------- */

  private spawnBurst(pos: THREE.Vector3, dir: THREE.Vector3, color: number, scale: number): void {
    const geo = new THREE.RingGeometry(0.15, 0.4, 18);
    geo.rotateX(-Math.PI / 2);
    const mesh = new THREE.Mesh(
      geo,
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, side: THREE.DoubleSide }),
    );
    mesh.position.copy(pos);
    this.scene.add(mesh);
    this.disposables.push(geo);
    this.effects.push({ mesh, life: 0.35, total: 0.35, kind: 'burst' });
    void dir;
    void scale;
  }

  private updateEffects(dt: number): void {
    for (let i = this.effects.length - 1; i >= 0; i--) {
      const e = this.effects[i];
      e.life -= dt;
      const p = 1 - Math.max(0, e.life / e.total);
      e.mesh.scale.setScalar(0.6 + p * 2.6);
      const material = (e.mesh as THREE.Mesh).material as THREE.MeshBasicMaterial;
      material.opacity = 0.9 * (1 - p);
      if (e.life <= 0) {
        this.scene.remove(e.mesh);
        this.effects.splice(i, 1);
      }
    }
  }

  /* ---------------------------------------------------------------- */
  /* Fin del combate                                                  */
  /* ---------------------------------------------------------------- */

  private onEnemyDefeated(): void {
    this.enemy.alive = false;
    this.enemy.rig.rotation.z = Math.PI * 0.42;
    if (this.enemy.sprite) (this.enemy.sprite.material as THREE.SpriteMaterial).rotation = -0.45;
    banner('¡Derrotado!', 900);
    this.state = 'ending';
    this.endTimer = 1.2;
    this.pendingOutcome = 'win';

    if (this.teamIndex < this.team.length - 1) {
      // siguiente criatura del entrenador
      window.setTimeout(() => {
        if (this.state !== 'ending' || this.finished) return;
        this.teamIndex++;
        this.scene.remove(this.enemy.rig);
        this.scene.remove(this.enemy.shadow);
        const entry = this.team[this.teamIndex];
        this.enemy = this.createFighter(
          createCombatant(entry.speciesId, entry.level),
          new THREE.Vector3(0, 0, ENEMY_Z),
          Math.PI,
        );
        const labels = [0, 1, 2, 3].map((i) => this.opts.input.label(`move${i + 1}` as 'move1'));
        this.hud.setup(this.ally.combatant, this.enemy.combatant, this.allyMoves(), labels);
        this.attachSprite(this.enemy, false);
        banner(`¡${this.enemy.combatant.species.name} entra al combate!`, 1100);
        this.state = 'fight';
        this.pendingOutcome = null;
        this.energy = Math.min(MAX_ENERGY, this.energy + 30);
        for (const p of this.projectiles) this.scene.remove(p.mesh);
        this.projectiles = [];
      }, 900);
    }
  }

  private onAllyDefeated(): void {
    this.ally.alive = false;
    this.ally.rig.rotation.z = Math.PI * 0.42;
    if (this.ally.sprite) (this.ally.sprite.material as THREE.SpriteMaterial).rotation = -0.45;
    banner('Tu equipo cayó...', 1200);
    this.state = 'ending';
    this.endTimer = 1.4;
    this.pendingOutcome = 'lose';
  }

  private finish(): void {
    if (this.finished) return;
    this.finished = true;
    const outcome = this.pendingOutcome ?? 'win';
    const captured =
      outcome === 'caught'
        ? { ...this.enemy.combatant, hp: Math.max(1, Math.round(maxHpOf(this.enemy.combatant) * 0.6)) }
        : undefined;

    const enemySnapshot = { ...this.enemy.combatant };
    this.cleanup();
    this.opts.onEnd(outcome, this.ally.combatant, enemySnapshot, captured);
  }

  private cleanup(): void {
    for (const f of [this.ally, this.enemy]) {
      this.scene.remove(f.shadow);
      if (!f.sprite) continue;
      this.scene.remove(f.sprite);
      (f.sprite.material as THREE.SpriteMaterial).map?.dispose();
      (f.sprite.material as THREE.SpriteMaterial).dispose();
      f.sprite = null;
    }
    for (const p of this.projectiles) this.scene.remove(p.mesh);
    for (const t of this.telegraphs) this.scene.remove(t.mesh);
    this.projectiles = [];
    this.telegraphs = [];
    for (const geo of this.disposables) geo.dispose();
    this.disposables = [];
  }

  /** Llamar al salir del combate (cambio de escena). */
  dispose(): void {
    this.cleanup();
    this.popups.clear();
  }
}

function statusBadges(f: Fighter): string[] {
  const out: string[] = [];
  if (f.slow > 0) out.push('LENTO');
  if (f.atkMod < 0.99) out.push('ATK ↓');
  if (f.atkMod > 1.01) out.push('ATK ↑');
  if (f.defMod < 0.99) out.push('DEF ↓');
  if (f.defMod > 1.01) out.push('DEF ↑');
  return out;
}
