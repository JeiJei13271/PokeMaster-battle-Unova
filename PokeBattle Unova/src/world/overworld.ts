import * as THREE from 'three';
import type { Input } from '../core/input';
import { MAPS, type MapDef, type NpcDef, type PropDef } from './maps';
import { attachOverworldSprite, facingFromYaw, updateOverworldSprite } from './overworldSprites';
import {
  animateCharacter,
  createBench,
  createCharacter,
  createFence,
  createFountain,
  createHouse,
  createLamp,
  createPlanter,
  createRock,
  particleTexture,
  createSign,
  type CharacterPalette,
  type CharacterRig,
} from './models';

export const TILE = 2;

const SOLID_TILES = new Set(['T', '#', 'W', '=', 'w']);

const PALETTES: Record<NpcDef['palette'], CharacterPalette> = {
  rival: { skin: 0xe8b48c, hair: 0x2c2f36, shirt: 0x2b2b3d, pants: 0x1f2029, accent: 0x7c3aed },
  prof: { skin: 0xd9a06f, hair: 0xd8d8d8, shirt: 0xf2f5f9, pants: 0x5b6472, accent: 0x3f6fa8 },
  trainer: { skin: 0xf0c39b, hair: 0x8b5a2b, shirt: 0xe4572e, pants: 0x2f3e57, accent: 0xffd447 },
  kid: { skin: 0xf3c9a6, hair: 0x3d2b20, shirt: 0x55d6ff, pants: 0x33507a },
  villager: { skin: 0xe3b491, hair: 0x5a4632, shirt: 0x8fbf6a, pants: 0x4a4a55 },
};

export const PLAYER_PALETTE: CharacterPalette = {
  skin: 0xf0c39b,
  hair: 0x2a2018,
  shirt: 0xf2f5f9,
  pants: 0x2b3a55,
  accent: 0xe4572e,
};

interface NpcInstance {
  def: NpcDef;
  rig: CharacterRig;
  pos: THREE.Vector3;
  /** Momento en que apareció, para animar la entrada */
  spawnAt: number;
}

export interface OverworldCallbacks {
  onEncounter: (speciesId: string, level: number) => void;
  /** Recibe el id del guion a reproducir (NPC o prop interactuable) */
  onInteract: (dialogId: string) => void;
  onWarp: (toMap: string, x: number, y: number, facing: number) => void;
  onSign: (text: string) => void;
  isBusy: () => boolean;
  hasFlag: (flag: string) => boolean;
}

export interface PlayerState {
  map: string;
  x: number;
  y: number;
  facing: number;
}

export class Overworld {
  scene = new THREE.Scene();
  camera: THREE.PerspectiveCamera;

  map!: MapDef;
  player!: CharacterRig;
  private playerPos = new THREE.Vector3();
  private playerFacing = Math.PI;
  private velocity = 0;

  private npcs: NpcInstance[] = [];
  private solidBoxes: { minX: number; maxX: number; minZ: number; maxZ: number }[] = [];
  private staticBoxes: { minX: number; maxX: number; minZ: number; maxZ: number }[] = [];
  private signSpots: { x: number; z: number; text: string }[] = [];
  private dialogSpots: { x: number; z: number; dialog: string; label: string }[] = [];
  private worldRoot = new THREE.Group();

  private lastTile = { x: -1, y: -1 };
  private warpLock = 0;
  private encounterMeter = 0;
  private elapsed = 0;
  private ambient: THREE.Points | null = null;
  private camTarget = new THREE.Vector3();
  private prompt: HTMLDivElement;

  private hemi: THREE.HemisphereLight;
  private sun: THREE.DirectionalLight;

  constructor(
    private input: Input,
    private callbacks: OverworldCallbacks,
  ) {
    this.camera = new THREE.PerspectiveCamera(52, 1, 0.1, 260);

    this.hemi = new THREE.HemisphereLight(0xdff1ff, 0x40522f, 1.05);
    this.scene.add(this.hemi);

    this.sun = new THREE.DirectionalLight(0xfff5e0, 1.6);
    this.sun.position.set(18, 34, 14);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.camera.left = -46;
    this.sun.shadow.camera.right = 46;
    this.sun.shadow.camera.top = 46;
    this.sun.shadow.camera.bottom = -46;
    this.sun.shadow.camera.far = 120;
    this.sun.shadow.bias = -0.0008;
    this.scene.add(this.sun);
    this.scene.add(this.worldRoot);

    this.prompt = document.createElement('div');
    this.prompt.style.cssText =
      'position:fixed;left:50%;bottom:64px;transform:translateX(-50%);padding:6px 14px;border-radius:999px;' +
      'background:rgba(10,14,24,.85);border:1px solid rgba(255,255,255,.16);font-size:13px;' +
      'z-index:11;pointer-events:none;display:none;color:#fff';
    document.body.appendChild(this.prompt);
  }

  resize(aspect: number): void {
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
  }

  load(state: PlayerState): void {
    const map = MAPS[state.map] ?? MAPS.pueblo;
    this.map = map;
    this.scene.background = new THREE.Color(map.sky);
    this.scene.fog = new THREE.Fog(map.fog, 46, 92);

    while (this.worldRoot.children.length) this.worldRoot.remove(this.worldRoot.children[0]);
    for (const child of [...this.scene.children]) {
      if (child !== this.worldRoot && child !== this.hemi && child !== this.sun) this.scene.remove(child);
    }

    this.npcs = [];
    this.staticBoxes = [];
    this.solidBoxes = this.staticBoxes;
    this.signSpots = [];
    this.dialogSpots = [];

    this.buildGround();
    this.buildProps();
    this.buildAmbient();
    this.buildNpcs();

    const spawn = this.tileToWorld(state.x, state.y);
    this.playerPos.set(spawn.x, 0, spawn.z);
    this.playerFacing = state.facing;
    this.velocity = 0;
    this.lastTile = { x: state.x, y: state.y };
    this.warpLock = 0.9;
    this.encounterMeter = 0;

    const rig = createCharacter(PLAYER_PALETTE);
    attachOverworldSprite(rig, PLAYER_PALETTE);
    rig.position.copy(this.playerPos);
    rig.rotation.y = this.playerFacing;
    this.worldRoot.add(rig);
    this.player = rig;

    this.camTarget.copy(this.playerPos);
    this.updateCamera(1, true);
  }

  getPlayerState(): PlayerState {
    const tile = this.worldToTile(this.playerPos.x, this.playerPos.z);
    return {
      map: this.map.id,
      x: Math.round(tile.x),
      y: Math.round(tile.y),
      facing: this.playerFacing,
    };
  }

  get position(): THREE.Vector3 {
    return this.playerPos;
  }

  /* ---------------------------------------------------------------- */
  /* Construcción del mapa                                             */
  /* ---------------------------------------------------------------- */

  private tileToWorld(x: number, y: number): { x: number; z: number } {
    return {
      x: (x - this.map.w / 2 + 0.5) * TILE,
      z: (y - this.map.h / 2 + 0.5) * TILE,
    };
  }

  private worldToTile(x: number, z: number): { x: number; y: number } {
    return {
      x: x / TILE + this.map.w / 2 - 0.5,
      y: z / TILE + this.map.h / 2 - 0.5,
    };
  }

  private tileAt(x: number, z: number): string {
    const t = this.worldToTile(x, z);
    const tx = Math.round(t.x);
    const ty = Math.round(t.y);
    if (tx < 0 || ty < 0 || tx >= this.map.w || ty >= this.map.h) return 'T';
    return this.map.tiles[ty][tx];
  }

  private buildGround(): void {
    const colors: Record<string, number> = {
      '.': 0xc9b184,
      ',': 0x86bb5f,
      g: 0x4f9a45,
      f: 0x86bb5f,
      T: 0x74ad55,
      '#': 0x7d9a5c,
      W: 0x3d8fc4,
      '=': 0x86bb5f,
      s: 0xd3cdbb,
      // interiores
      r: 0x9c6b45,
      w: 0xd8c6a4,
    };

    const positions: number[] = [];
    const cols: number[] = [];
    const normals: number[] = [];
    const half = TILE / 2;
    const color = new THREE.Color();

    for (let y = 0; y < this.map.h; y++) {
      for (let x = 0; x < this.map.w; x++) {
        const ch = this.map.tiles[y][x];
        // La fila sur de un interior no lleva pared visible: se pinta como suelo.
        const c = ch === 'w' && y === this.map.h - 1 ? 0x9c6b45 : (colors[ch] ?? 0x86bb5f);
        color.setHex(c);
        const jitter = 0.94 + Math.random() * 0.12;
        const r = color.r * jitter;
        const g = color.g * jitter;
        const b = color.b * jitter;
        const { x: wx, z: wz } = this.tileToWorld(x, y);
        const yPos = ch === 'W' ? -0.1 : 0;

        const corners: [number, number][] = [
          [wx - half, wz - half],
          [wx + half, wz - half],
          [wx + half, wz + half],
          [wx - half, wz + half],
        ];
        // Orden antihorario visto desde arriba: si se invierte, la cara
        // apunta hacia abajo y el suelo desaparece (se cuela el cielo).
        const order = [0, 2, 1, 0, 3, 2];
        for (const idx of order) {
          positions.push(corners[idx][0], yPos, corners[idx][1]);
          cols.push(r, g, b);
          normals.push(0, 1, 0);
        }
      }
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));

    const ground = new THREE.Mesh(
      geometry,
      new THREE.MeshLambertMaterial({ vertexColors: true }),
    );
    ground.receiveShadow = true;
    this.worldRoot.add(ground);

    this.buildInstancedVegetation();
  }

  private buildInstancedVegetation(): void {
    const treeTiles: THREE.Vector3[] = [];
    const rockTiles: THREE.Vector3[] = [];
    const grassTiles: THREE.Vector3[] = [];
    const flowerTiles: THREE.Vector3[] = [];

    for (let y = 0; y < this.map.h; y++) {
      for (let x = 0; x < this.map.w; x++) {
        const ch = this.map.tiles[y][x];
        const { x: wx, z: wz } = this.tileToWorld(x, y);
        const v = new THREE.Vector3(wx, 0, wz);
        if (ch === 'T') treeTiles.push(v);
        else if (ch === '#') rockTiles.push(v);
        else if (ch === 'g') grassTiles.push(v);
        else if (ch === 'f') flowerTiles.push(v);
      }
    }

    const dummy = new THREE.Object3D();

    if (treeTiles.length) {
      const trunkGeo = new THREE.CylinderGeometry(0.16, 0.24, 1.2, 6).translate(0, 0.6, 0);
      const leafGeo = new THREE.IcosahedronGeometry(0.95, 0).translate(0, 1.8, 0);
      const topGeo = new THREE.IcosahedronGeometry(0.6, 0).translate(0.16, 2.55, 0.1);
      const trunkMat = new THREE.MeshStandardMaterial({ color: 0x8a5a3b, roughness: 1, flatShading: true });
      const leafMat = new THREE.MeshStandardMaterial({ color: 0x2f8f4e, roughness: 1, flatShading: true });
      const topMat = new THREE.MeshStandardMaterial({ color: 0x3aa35c, roughness: 1, flatShading: true });

      const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, treeTiles.length);
      const leaves = new THREE.InstancedMesh(leafGeo, leafMat, treeTiles.length);
      const tops = new THREE.InstancedMesh(topGeo, topMat, treeTiles.length);
      leaves.castShadow = true;
      tops.castShadow = true;

      treeTiles.forEach((p, i) => {
        const s = 0.85 + Math.random() * 0.4;
        dummy.position.set(p.x + (Math.random() - 0.5) * 0.5, 0, p.z + (Math.random() - 0.5) * 0.5);
        dummy.rotation.set(0, Math.random() * Math.PI * 2, 0);
        dummy.scale.setScalar(s);
        dummy.updateMatrix();
        trunks.setMatrixAt(i, dummy.matrix);
        leaves.setMatrixAt(i, dummy.matrix);
        tops.setMatrixAt(i, dummy.matrix);
      });
      this.worldRoot.add(trunks, leaves, tops);
    }

    if (rockTiles.length) {
      const geo = new THREE.DodecahedronGeometry(0.68, 0).translate(0, 0.45, 0);
      const material = new THREE.MeshStandardMaterial({ color: 0x8b8f98, roughness: 1, flatShading: true });
      const rocks = new THREE.InstancedMesh(geo, material, rockTiles.length);
      rocks.castShadow = true;
      rocks.receiveShadow = true;
      rockTiles.forEach((p, i) => {
        dummy.position.set(p.x, 0, p.z);
        dummy.rotation.set(Math.random(), Math.random() * 6.28, Math.random());
        dummy.scale.setScalar(0.85 + Math.random() * 0.4);
        dummy.updateMatrix();
        rocks.setMatrixAt(i, dummy.matrix);
      });
      this.worldRoot.add(rocks);
    }

    if (grassTiles.length) {
      const bladeGeo = new THREE.ConeGeometry(0.11, 0.62, 4).translate(0, 0.31, 0);
      const bladeMat = new THREE.MeshStandardMaterial({ color: 0x2f7a35, roughness: 1, flatShading: true });
      const perTile = 5;
      const blades = new THREE.InstancedMesh(bladeGeo, bladeMat, grassTiles.length * perTile);
      blades.castShadow = false;
      let i = 0;
      for (const p of grassTiles) {
        for (let k = 0; k < perTile; k++) {
          dummy.position.set(
            p.x + (Math.random() - 0.5) * TILE * 0.85,
            0,
            p.z + (Math.random() - 0.5) * TILE * 0.85,
          );
          dummy.rotation.set((Math.random() - 0.5) * 0.3, Math.random() * 6.28, (Math.random() - 0.5) * 0.3);
          dummy.scale.set(1, 0.7 + Math.random() * 0.8, 1);
          dummy.updateMatrix();
          blades.setMatrixAt(i++, dummy.matrix);
        }
      }
      this.worldRoot.add(blades);
    }

    if (flowerTiles.length) {
      const petalGeo = new THREE.SphereGeometry(0.13, 6, 5).translate(0, 0.28, 0);
      const petalMat = new THREE.MeshStandardMaterial({ roughness: 0.9, flatShading: true, vertexColors: false });
      const flowers = new THREE.InstancedMesh(petalGeo, petalMat, flowerTiles.length);
      const palette = [0xff6b8a, 0xffd447, 0x9b7bff, 0xffffff];
      const c = new THREE.Color();
      flowerTiles.forEach((p, i) => {
        dummy.position.set(p.x + (Math.random() - 0.5) * 1.2, 0, p.z + (Math.random() - 0.5) * 1.2);
        dummy.rotation.set(0, Math.random() * 6.28, 0);
        dummy.scale.setScalar(0.8 + Math.random() * 0.6);
        dummy.updateMatrix();
        flowers.setMatrixAt(i, dummy.matrix);
        c.setHex(palette[Math.floor(Math.random() * palette.length)]);
        flowers.setColorAt(i, c);
      });
      this.worldRoot.add(flowers);
    }

    // Paredes de interior: bloques altos sobre las casillas 'w'.
    const wallTiles: { x: number; y: number }[] = [];
    for (let y = 0; y < this.map.h; y++) {
      for (let x = 0; x < this.map.w; x++) {
        // La fila sur no se dibuja: la cámara mira desde ahí y taparía al jugador.
        if (this.map.tiles[y][x] === 'w' && y < this.map.h - 1) wallTiles.push({ x, y });
      }
    }
    if (wallTiles.length) {
      const wallGeo = new THREE.BoxGeometry(TILE, 2.6, TILE).translate(0, 1.3, 0);
      const wallMat = new THREE.MeshStandardMaterial({ color: 0xd8c6a4, roughness: 0.95, flatShading: true });
      const walls = new THREE.InstancedMesh(wallGeo, wallMat, wallTiles.length);
      walls.castShadow = true;
      walls.receiveShadow = true;
      const c = new THREE.Color();
      wallTiles.forEach((p, i) => {
        const { x: wx, z: wz } = this.tileToWorld(p.x, p.y);
        dummy.position.set(wx, 0, wz);
        dummy.rotation.set(0, 0, 0);
        dummy.scale.setScalar(1);
        dummy.updateMatrix();
        walls.setMatrixAt(i, dummy.matrix);
        c.setHex(0xd8c6a4).multiplyScalar(0.9 + Math.random() * 0.16);
        walls.setColorAt(i, c);
      });
      this.worldRoot.add(walls);
    }
  }

  /** Motas de polen/hierba flotando en los mapas exteriores. */
  private buildAmbient(): void {
    if (this.ambient) {
      this.worldRoot.remove(this.ambient);
      this.ambient.geometry.dispose();
      (this.ambient.material as THREE.PointsMaterial).dispose();
      this.ambient = null;
    }
    if (this.map.id === 'centro' || this.map.id === 'casa_p1' || this.map.id === 'casa_p2' || this.map.id === 'casa_bel' || this.map.id === 'lab') {
      return;
    }

    const count = 90;
    const positions = new Float32Array(count * 3);
    const width = this.map.w * TILE;
    const depth = this.map.h * TILE;
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * width;
      positions[i * 3 + 1] = 0.8 + Math.random() * 4.5;
      positions[i * 3 + 2] = (Math.random() - 0.5) * depth;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const material = new THREE.PointsMaterial({
      color: this.map.id === 'bosque' ? 0xd9f7b0 : 0xfff4c2,
      size: 0.22,
      map: particleTexture(),
      transparent: true,
      opacity: 0.6,
      depthWrite: false,
    });
    this.ambient = new THREE.Points(geometry, material);
    this.worldRoot.add(this.ambient);
  }

  private buildProps(): void {
    for (const prop of this.map.props) {
      const group = new THREE.Group();
      const { x: wx, z: wz } = this.tileToWorld(prop.x, prop.y);
      group.position.set(wx, 0, wz);

      switch (prop.type) {
        case 'house': {
          const w = (prop.w ?? 4) * TILE;
          const d = (prop.d ?? 3) * TILE;
          const house = createHouse(w, d, 0xf3e4c8, prop.color ?? 0xb4443c);
          group.add(house);
          const cx = wx + ((prop.w ?? 4) - 1) * (TILE / 2);
          const cz = wz + ((prop.d ?? 3) - 1) * (TILE / 2);
          group.position.set(cx, 0, cz);
          this.addSolidBox(cx, cz, w, d);
          break;
        }
        case 'fountain': {
          group.add(createFountain());
          this.addSolidBox(wx, wz, 3.4, 3.4);
          break;
        }
        case 'sign': {
          group.add(createSign());
          this.signSpots.push({ x: wx, z: wz, text: prop.text ?? '' });
          break;
        }
        case 'rock': {
          group.add(createRock());
          break;
        }
        case 'lamp': {
          group.add(createLamp());
          break;
        }
        case 'bench': {
          group.add(createBench());
          this.addSolidBox(wx, wz, 1.9, 0.75);
          break;
        }
        case 'planter': {
          group.add(createPlanter());
          this.addSolidBox(wx, wz, 1.3, 0.75);
          break;
        }
        case 'fence': {
          const fence = createFence((prop.w ?? 3) * TILE);
          group.add(fence);
          this.addSolidBox(wx + ((prop.w ?? 3) - 1) * (TILE / 2), wz, (prop.w ?? 3) * TILE, 0.55);
          group.position.set(wx + ((prop.w ?? 3) - 1) * (TILE / 2), 0, wz);
          break;
        }
        case 'table': {
          const woodTop = new THREE.MeshStandardMaterial({ color: 0x9a6b3f, roughness: 0.9, flatShading: true });
          const woodLeg = new THREE.MeshStandardMaterial({ color: 0x6d4a2c, roughness: 1 });
          const top = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.18, 1.05), woodTop);
          top.position.y = 0.82;
          top.castShadow = true;
          const legs = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.76, 0.8), woodLeg);
          legs.position.y = 0.38;
          group.add(top, legs);
          this.addSolidBox(wx, wz, 1.7, 1.05);
          break;
        }
        case 'bed': {
          const frame = new THREE.Mesh(
            new THREE.BoxGeometry(1.6, 0.45, 2.4),
            new THREE.MeshStandardMaterial({ color: 0x6b4b7a, roughness: 0.95 }),
          );
          frame.position.y = 0.23;
          const mattress = new THREE.Mesh(
            new THREE.BoxGeometry(1.5, 0.28, 2.2),
            new THREE.MeshStandardMaterial({ color: 0xf2ede4, roughness: 1 }),
          );
          mattress.position.y = 0.57;
          const pillow = new THREE.Mesh(
            new THREE.BoxGeometry(1.2, 0.22, 0.5),
            new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1 }),
          );
          pillow.position.set(0, 0.74, -0.8);
          frame.castShadow = true;
          group.add(frame, mattress, pillow);
          this.addSolidBox(wx, wz, 1.6, 2.4);
          break;
        }
        case 'shelf': {
          const shelf = new THREE.Mesh(
            new THREE.BoxGeometry(1.8, 2.0, 0.55),
            new THREE.MeshStandardMaterial({ color: 0x7a5233, roughness: 1, flatShading: true }),
          );
          shelf.position.y = 1.0;
          shelf.castShadow = true;
          group.add(shelf);
          this.addSolidBox(wx, wz, 1.8, 0.6);
          break;
        }
        case 'package': {
          const box = new THREE.Mesh(
            new THREE.BoxGeometry(0.9, 0.7, 0.9),
            new THREE.MeshStandardMaterial({ color: 0xd94b4b, roughness: 0.8 }),
          );
          box.position.y = 0.55;
          box.castShadow = true;
          const ribbon = new THREE.Mesh(
            new THREE.BoxGeometry(0.96, 0.74, 0.16),
            new THREE.MeshStandardMaterial({ color: 0xffe08a, roughness: 0.6 }),
          );
          ribbon.position.y = 0.55;
          group.add(box, ribbon);
          this.addSolidBox(wx, wz, 1.0, 1.0);
          break;
        }
        case 'flower': {
          break;
        }
      }

      if (prop.dialog) {
        this.dialogSpots.push({
          x: wx,
          z: wz,
          dialog: prop.dialog,
          label: prop.label ?? 'Examinar',
        });
      }

      this.worldRoot.add(group);
    }
  }

  private addSolidBox(cx: number, cz: number, w: number, d: number): void {
    this.staticBoxes.push({
      minX: cx - w / 2,
      maxX: cx + w / 2,
      minZ: cz - d / 2,
      maxZ: cz + d / 2,
    });
  }

  /** Reconstruye los NPC visibles (por ejemplo, tras cambiar flags en un guion). */
  refreshNpcs(): void {
    for (const npc of this.npcs) this.worldRoot.remove(npc.rig);
    this.npcs = [];
    this.buildNpcs();
  }

  private buildNpcs(): void {
    for (const def of this.map.npcs) {
      if (def.requiresFlag && !this.callbacks.hasFlag(def.requiresFlag)) continue;
      if (def.hiddenAfterFlag && this.callbacks.hasFlag(def.hiddenAfterFlag)) continue;
      const rig = createCharacter(PALETTES[def.palette]);
      attachOverworldSprite(rig, PALETTES[def.palette]);
      const { x: wx, z: wz } = this.tileToWorld(def.x, def.y);
      rig.position.set(wx, 0, wz);
      rig.rotation.y = def.facing ?? Math.PI;
      rig.userData.phase = Math.random() * 6;
      rig.scale.setScalar(0.6);
      this.worldRoot.add(rig);
      this.npcs.push({ def, rig, pos: new THREE.Vector3(wx, 0, wz), spawnAt: this.elapsed });
    }
  }

  /* ---------------------------------------------------------------- */
  /* Update                                                            */
  /* ---------------------------------------------------------------- */

  private blocked(x: number, z: number): boolean {
    const r = 0.42;
    for (const [ox, oz] of [
      [r, r],
      [-r, r],
      [r, -r],
      [-r, -r],
    ]) {
      if (SOLID_TILES.has(this.tileAt(x + ox, z + oz))) return true;
    }
    for (const box of this.staticBoxes) {
      if (
        x + r > box.minX &&
        x - r < box.maxX &&
        z + r > box.minZ &&
        z - r < box.maxZ
      ) {
        return true;
      }
    }
    for (const npc of this.npcs) {
      if (Math.hypot(npc.pos.x - x, npc.pos.z - z) < 0.85) return true;
    }
    return false;
  }

  update(dt: number): void {
    this.elapsed += dt;
    if (this.ambient) {
      this.ambient.rotation.y += dt * 0.025;
      this.ambient.position.y = Math.sin(this.elapsed * 0.5) * 0.15;
    }
    this.warpLock = Math.max(0, this.warpLock - dt);
    const busy = this.callbacks.isBusy();

    if (!busy) {
      const mv = this.input.moveVector();
      const speed = this.input.isDown('ShiftLeft', 'ShiftRight') ? 8.6 : 5.2;
      const dx = mv.x * speed * dt;
      const dz = -mv.y * speed * dt;

      let moved = 0;
      if (dx !== 0 && !this.blocked(this.playerPos.x + dx, this.playerPos.z)) {
        this.playerPos.x += dx;
        moved = 1;
      }
      if (dz !== 0 && !this.blocked(this.playerPos.x, this.playerPos.z + dz)) {
        this.playerPos.z += dz;
        moved = 1;
      }

      this.velocity = moved ? speed : 0;

      if (mv.x !== 0 || mv.y !== 0) {
        const target = Math.atan2(mv.x, -mv.y);
        let diff = target - this.playerFacing;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        this.playerFacing += diff * Math.min(1, dt * 14);
      }

      this.player.position.copy(this.playerPos);
      this.player.rotation.y = this.playerFacing;
      animateCharacter(this.player, this.elapsed, this.velocity);
      updateOverworldSprite(
        this.player,
        facingFromYaw(this.playerFacing),
        this.velocity > 0.4 ? Math.floor(this.elapsed * 9) % 2 : 0,
        this.elapsed,
        this.velocity > 0.4,
      );

      this.checkTileEvents(dt, moved > 0);
      this.checkInteraction();
    } else {
      animateCharacter(this.player, this.elapsed, 0);
      this.velocity = 0;
      this.prompt.style.display = 'none';
    }

    for (const npc of this.npcs) {
      animateCharacter(npc.rig, this.elapsed + npc.rig.userData.phase, 0);
      updateOverworldSprite(npc.rig, facingFromYaw(npc.def.facing ?? Math.PI), 0, this.elapsed, false);
      // Entrada suave para que los NPC no aparezcan de golpe.
      const t = Math.min(1, (this.elapsed - npc.spawnAt) / 0.3);
      npc.rig.scale.setScalar(0.6 + 0.4 * (t * t * (3 - 2 * t)));
    }

    this.updateCamera(dt, false);
  }

  private checkTileEvents(dt: number, moved: boolean): void {
    const tile = this.worldToTile(this.playerPos.x, this.playerPos.z);
    const tx = Math.round(tile.x);
    const ty = Math.round(tile.y);

    if (tx !== this.lastTile.x || ty !== this.lastTile.y) {
      for (const warp of this.map.warps) {
        if (warp.requiresFlag && !this.callbacks.hasFlag(warp.requiresFlag)) continue;
        if (warp.x !== tx || warp.y !== ty) continue;
        // Si el bloqueo sigue activo no marcamos la casilla: se reintenta al expirar.
        if (this.warpLock > 0) return;
        this.lastTile = { x: tx, y: ty };
        this.warpLock = 1.4;
        this.callbacks.onWarp(warp.toMap, warp.toX, warp.toY, warp.facing ?? 0);
        return;
      }
      this.lastTile = { x: tx, y: ty };
    }

    if (!moved) return;
    const onGrass = this.map.tiles[ty]?.[tx] === 'g';
    if (!onGrass || this.map.encounters.length === 0) {
      this.encounterMeter = Math.max(0, this.encounterMeter - dt * 0.4);
      return;
    }

    this.encounterMeter += dt;
    if (this.encounterMeter > 0.55) {
      this.encounterMeter = 0;
      if (Math.random() < 0.22) {
        const total = this.map.encounters.reduce((sum, e) => sum + e.weight, 0);
        let roll = Math.random() * total;
        const entry =
          this.map.encounters.find((e) => (roll -= e.weight) <= 0) ?? this.map.encounters[0];
        const level = entry.min + Math.floor(Math.random() * (entry.max - entry.min + 1));
        this.callbacks.onEncounter(entry.speciesId, level);
      }
    }
  }

  private checkInteraction(): void {
    const near = this.npcs.find(
      (npc) => Math.hypot(npc.pos.x - this.playerPos.x, npc.pos.z - this.playerPos.z) < 3,
    );
    const dialogSpot = this.dialogSpots.find(
      (s) => Math.hypot(s.x - this.playerPos.x, s.z - this.playerPos.z) < 2.4,
    );
    const sign = this.signSpots.find(
      (s) => Math.hypot(s.x - this.playerPos.x, s.z - this.playerPos.z) < 2.3,
    );

    let label = '';
    if (near) label = `E · Hablar con ${near.def.name}`;
    else if (dialogSpot) label = `E · ${dialogSpot.label}`;
    else if (sign) label = 'E · Leer cartel';

    if (label) {
      this.prompt.textContent = label;
      this.prompt.style.display = 'block';
      if (this.input.wasPressed('KeyE', 'Enter')) {
        if (near) this.callbacks.onInteract(near.def.dialog);
        else if (dialogSpot) this.callbacks.onInteract(dialogSpot.dialog);
        else if (sign) this.callbacks.onSign(sign.text);
      }
    } else {
      this.prompt.style.display = 'none';
    }
  }

  private updateCamera(dt: number, instant: boolean): void {
    const desired = new THREE.Vector3(
      this.playerPos.x,
      this.playerPos.y + 12.5,
      this.playerPos.z + 14.5,
    );
    const look = new THREE.Vector3(this.playerPos.x, this.playerPos.y + 1.4, this.playerPos.z - 0.5);

    if (instant) {
      this.camera.position.copy(desired);
      this.camTarget.copy(look);
    } else {
      const k = 1 - Math.exp(-dt * 4.5);
      this.camera.position.lerp(desired, k);
      this.camTarget.lerp(look, k);
    }
    this.camera.lookAt(this.camTarget);
  }
}
