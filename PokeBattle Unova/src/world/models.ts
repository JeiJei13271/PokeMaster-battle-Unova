import * as THREE from 'three';
import type { Species } from '../types';

const geoCache = new Map<string, THREE.BufferGeometry>();
const matCache = new Map<string, THREE.MeshStandardMaterial>();

function geo(key: string, make: () => THREE.BufferGeometry): THREE.BufferGeometry {
  let g = geoCache.get(key);
  if (!g) {
    g = make();
    geoCache.set(key, g);
  }
  return g;
}

function mat(color: number, opts: THREE.MeshStandardMaterialParameters = {}): THREE.MeshStandardMaterial {
  const key = `${color}-${opts.flatShading ? 'f' : 's'}-${opts.roughness ?? 0.8}`;
  let m = matCache.get(key);
  if (!m) {
    m = new THREE.MeshStandardMaterial({
      color,
      roughness: 0.8,
      flatShading: true,
      ...opts,
    });
    matCache.set(key, m);
  }
  return m;
}

function mesh(
  g: THREE.BufferGeometry,
  color: number,
  position: [number, number, number],
  scale: [number, number, number] = [1, 1, 1],
): THREE.Mesh {
  const m = new THREE.Mesh(g, mat(color));
  m.position.set(...position);
  m.scale.set(...scale);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

/* ------------------------------------------------------------------ */
/* Personajes                                                          */
/* ------------------------------------------------------------------ */

export interface CharacterPalette {
  skin: number;
  hair: number;
  shirt: number;
  pants: number;
  accent?: number;
}

export interface CharacterRig extends THREE.Group {
  userData: {
    leftLeg: THREE.Object3D;
    rightLeg: THREE.Object3D;
    leftArm: THREE.Object3D;
    rightArm: THREE.Object3D;
    phase: number;
  };
}

export function createCharacter(palette: CharacterPalette): CharacterRig {
  const g = new THREE.Group() as CharacterRig;

  const legGeo = geo('leg', () => new THREE.BoxGeometry(0.2, 0.52, 0.22));
  const leftLeg = mesh(legGeo, palette.pants, [-0.15, 0.26, 0]);
  const rightLeg = mesh(legGeo, palette.pants, [0.15, 0.26, 0]);
  g.add(leftLeg, rightLeg);

  const torso = mesh(geo('torso', () => new THREE.BoxGeometry(0.58, 0.56, 0.34)), palette.shirt, [0, 0.8, 0]);
  g.add(torso);

  if (palette.accent !== undefined) {
    const stripe = mesh(
      geo('stripe', () => new THREE.BoxGeometry(0.6, 0.1, 0.36)),
      palette.accent,
      [0, 0.74, 0],
    );
    g.add(stripe);
  }

  const armGeo = geo('arm', () => new THREE.BoxGeometry(0.16, 0.5, 0.18));
  const leftArm = mesh(armGeo, palette.skin, [-0.36, 0.86, 0]);
  const rightArm = mesh(armGeo, palette.skin, [0.36, 0.86, 0]);
  g.add(leftArm, rightArm);

  const head = mesh(geo('head', () => new THREE.SphereGeometry(0.29, 10, 8)), palette.skin, [0, 1.3, 0]);
  g.add(head);

  const hair = mesh(
    geo('hair', () => new THREE.SphereGeometry(0.3, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.62)),
    palette.hair,
    [0, 1.34, 0],
  );
  g.add(hair);

  const eyeGeo = geo('eye', () => new THREE.SphereGeometry(0.045, 6, 5));
  g.add(
    mesh(eyeGeo, 0x111827, [-0.11, 1.3, 0.26]),
    mesh(eyeGeo, 0x111827, [0.11, 1.3, 0.26]),
  );

  // Sombra de contacto suave bajo el personaje.
  const shadowGeo = new THREE.CircleGeometry(0.46, 20);
  shadowGeo.rotateX(-Math.PI / 2);
  const shadow = new THREE.Mesh(
    shadowGeo,
    new THREE.MeshBasicMaterial({ color: 0x0b1220, transparent: true, opacity: 0.26, depthWrite: false }),
  );
  shadow.name = 'contact-shadow';
  shadow.position.y = 0.015;
  shadow.scale.set(1, 1, 0.8);
  g.add(shadow);

  g.userData = { leftLeg, rightLeg, leftArm, rightArm, phase: Math.random() * Math.PI * 2 };
  return g;
}

export function animateCharacter(rig: CharacterRig, t: number, speed: number): void {
  const { leftLeg, rightLeg, leftArm, rightArm } = rig.userData;
  const swing = Math.sin(t * 11) * Math.min(1, speed / 5) * 0.6;
  leftLeg.rotation.x = swing;
  rightLeg.rotation.x = -swing;
  leftArm.rotation.x = -swing * 0.8;
  rightArm.rotation.x = swing * 0.8;
  const bob = Math.abs(Math.sin(t * 11)) * 0.05 * Math.min(1, speed / 5);
  rig.position.y = bob;
}

/* ------------------------------------------------------------------ */
/* Criaturas                                                           */
/* ------------------------------------------------------------------ */

export interface CreatureRig extends THREE.Group {
  userData: {
    body: THREE.Object3D;
    head: THREE.Object3D;
    legs: THREE.Object3D[];
    tail?: THREE.Object3D;
    phase: number;
  };
}

export function createCreature(species: Species): CreatureRig {
  const g = new THREE.Group() as CreatureRig;
  const s = species.size;
  const bodyColor = species.body;
  const accent = species.accent;
  const legs: THREE.Object3D[] = [];

  if (species.shape === 'biped') {
    const body = mesh(
      geo('cbody', () => new THREE.SphereGeometry(0.42, 12, 10)),
      bodyColor,
      [0, 0.62 * s, 0],
      [1, 1.15, 0.9],
    );
    body.scale.multiplyScalar(s);
    g.add(body);

    const belly = mesh(
      geo('cbelly', () => new THREE.SphereGeometry(0.28, 10, 8)),
      accent,
      [0, 0.58 * s, 0.16 * s],
      [1, 1.1, 0.5],
    );
    belly.scale.multiplyScalar(s);
    g.add(belly);

    const head = mesh(geo('chead', () => new THREE.SphereGeometry(0.3, 12, 10)), bodyColor, [0, 1.18 * s, 0.02]);
    head.scale.multiplyScalar(s);
    g.add(head);

    const legGeo = geo('cleg', () => new THREE.CapsuleGeometry(0.1, 0.22, 3, 6));
    const l1 = mesh(legGeo, accent, [-0.18 * s, 0.16 * s, 0]);
    const l2 = mesh(legGeo, accent, [0.18 * s, 0.16 * s, 0]);
    l1.scale.multiplyScalar(s);
    l2.scale.multiplyScalar(s);
    legs.push(l1, l2);
    g.add(l1, l2);

    const armGeo = geo('carm', () => new THREE.CapsuleGeometry(0.07, 0.24, 3, 6));
    const a1 = mesh(armGeo, bodyColor, [-0.4 * s, 0.68 * s, 0]);
    const a2 = mesh(armGeo, bodyColor, [0.4 * s, 0.68 * s, 0]);
    a1.scale.multiplyScalar(s);
    a2.scale.multiplyScalar(s);
    g.add(a1, a2);

    // orejas / hojas
    const earGeo = geo('cear', () => new THREE.ConeGeometry(0.1, 0.34, 6));
    const e1 = mesh(earGeo, accent, [-0.16 * s, 1.42 * s, 0]);
    const e2 = mesh(earGeo, accent, [0.16 * s, 1.42 * s, 0]);
    e1.rotation.z = 0.25;
    e2.rotation.z = -0.25;
    e1.scale.multiplyScalar(s);
    e2.scale.multiplyScalar(s);
    g.add(e1, e2);

    const eyeGeo = geo('ceye', () => new THREE.SphereGeometry(0.055, 8, 6));
    g.add(
      mesh(eyeGeo, 0x0b1220, [-0.12 * s, 1.2 * s, 0.26 * s]),
      mesh(eyeGeo, 0x0b1220, [0.12 * s, 1.2 * s, 0.26 * s]),
    );

    g.userData = { body, head, legs, phase: Math.random() * 6.28 };
    return g;
  }

  if (species.shape === 'quad') {
    const body = mesh(
      geo('qbody', () => new THREE.SphereGeometry(0.42, 12, 10)),
      bodyColor,
      [0, 0.56 * s, 0],
      [1.05, 0.92, 1.35],
    );
    body.scale.multiplyScalar(s);
    g.add(body);

    const head = mesh(geo('qhead', () => new THREE.SphereGeometry(0.27, 12, 10)), bodyColor, [0, 0.68 * s, 0.55 * s]);
    head.scale.multiplyScalar(s);
    g.add(head);

    const snout = mesh(geo('qsnout', () => new THREE.SphereGeometry(0.15, 8, 6)), accent, [0, 0.62 * s, 0.76 * s]);
    snout.scale.multiplyScalar(s);
    g.add(snout);

    const legGeo = geo('qleg', () => new THREE.CapsuleGeometry(0.09, 0.3, 3, 6));
    const offsets: [number, number][] = [
      [-0.26, 0.32],
      [0.26, 0.32],
      [-0.26, -0.34],
      [0.26, -0.34],
    ];
    for (const [x, z] of offsets) {
      const leg = mesh(legGeo, accent, [x * s, 0.2 * s, z * s]);
      leg.scale.multiplyScalar(s);
      legs.push(leg);
      g.add(leg);
    }

    const tail = mesh(geo('qtail', () => new THREE.ConeGeometry(0.12, 0.5, 6)), accent, [0, 0.6 * s, -0.62 * s]);
    tail.rotation.x = -Math.PI * 0.42;
    tail.scale.multiplyScalar(s);
    g.add(tail);

    const eyeGeo = geo('ceye', () => new THREE.SphereGeometry(0.055, 8, 6));
    g.add(
      mesh(eyeGeo, 0x0b1220, [-0.13 * s, 0.76 * s, 0.68 * s]),
      mesh(eyeGeo, 0x0b1220, [0.13 * s, 0.76 * s, 0.68 * s]),
    );

    g.userData = { body, head, legs, tail, phase: Math.random() * 6.28 };
    return g;
  }

  if (species.shape === 'serpent') {
    const body = mesh(
      geo('sbody', () => new THREE.SphereGeometry(0.3, 10, 8)),
      bodyColor,
      [0, 0.4 * s, 0],
      [1, 1.4, 1],
    );
    body.scale.multiplyScalar(s);
    g.add(body);

    for (let i = 0; i < 3; i++) {
      const seg = mesh(
        geo('sseg', () => new THREE.SphereGeometry(0.22, 10, 8)),
        i % 2 === 0 ? bodyColor : accent,
        [0, 0.22 * s + i * 0.02, -0.24 * s - i * 0.22 * s],
        [1, 0.9, 1],
      );
      seg.scale.multiplyScalar(s);
      g.add(seg);
    }

    const head = mesh(geo('shead', () => new THREE.SphereGeometry(0.26, 12, 10)), bodyColor, [0, 0.95 * s, 0.06 * s]);
    head.scale.multiplyScalar(s);
    g.add(head);

    const hood = mesh(geo('shood', () => new THREE.ConeGeometry(0.32, 0.22, 6)), accent, [0, 0.86 * s, -0.04 * s]);
    hood.scale.multiplyScalar(s);
    g.add(hood);

    const eyeGeo = geo('ceye', () => new THREE.SphereGeometry(0.05, 8, 6));
    g.add(
      mesh(eyeGeo, 0xfde047, [-0.11 * s, 1.0 * s, 0.22 * s]),
      mesh(eyeGeo, 0xfde047, [0.11 * s, 1.0 * s, 0.22 * s]),
    );

    g.userData = { body, head, legs, phase: Math.random() * 6.28 };
    return g;
  }

  // orb
  const body = mesh(geo('obody', () => new THREE.SphereGeometry(0.44, 14, 12)), bodyColor, [0, 0.62 * s, 0], [1, 0.95, 1]);
  body.scale.multiplyScalar(s);
  g.add(body);

  const ring = mesh(
    geo('oring', () => new THREE.TorusGeometry(0.42, 0.06, 6, 16)),
    accent,
    [0, 0.62 * s, 0],
  );
  ring.rotation.x = Math.PI / 2;
  ring.scale.multiplyScalar(s);
  g.add(ring);

  const head = mesh(geo('ohead', () => new THREE.SphereGeometry(0.26, 12, 10)), bodyColor, [0, 1.12 * s, 0]);
  head.scale.multiplyScalar(s);
  g.add(head);

  const finGeo = geo('ofin', () => new THREE.ConeGeometry(0.12, 0.3, 6));
  const f1 = mesh(finGeo, accent, [-0.26 * s, 1.32 * s, 0]);
  const f2 = mesh(finGeo, accent, [0.26 * s, 1.32 * s, 0]);
  f1.rotation.z = 0.4;
  f2.rotation.z = -0.4;
  f1.scale.multiplyScalar(s);
  f2.scale.multiplyScalar(s);
  g.add(f1, f2);

  const eyeGeo = geo('ceye', () => new THREE.SphereGeometry(0.06, 8, 6));
  g.add(
    mesh(eyeGeo, 0x0b1220, [-0.11 * s, 1.14 * s, 0.22 * s]),
    mesh(eyeGeo, 0x0b1220, [0.11 * s, 1.14 * s, 0.22 * s]),
  );

  g.userData = { body, head, legs, phase: Math.random() * 6.28 };
  return g;
}

export function animateCreature(rig: CreatureRig, t: number, moving: boolean): void {
  const { body, head, legs, tail } = rig.userData;
  const speed = moving ? 9 : 2.4;
  const bob = Math.sin(t * speed + rig.userData.phase) * (moving ? 0.09 : 0.04);
  body.position.y += 0; // base se fija en createCreature
  rig.position.y = Math.max(0, bob * 0.6);
  head.rotation.z = Math.sin(t * 2.2 + rig.userData.phase) * 0.06;
  for (let i = 0; i < legs.length; i++) {
    legs[i].rotation.x = Math.sin(t * speed + (i % 2 === 0 ? 0 : Math.PI)) * (moving ? 0.65 : 0.05);
  }
  if (tail) tail.rotation.y = Math.sin(t * 3) * 0.35;
}

/* ------------------------------------------------------------------ */
/* Props del mundo                                                     */
/* ------------------------------------------------------------------ */

let particleTextureCache: THREE.Texture | null = null;

/** Textura circular suave para partículas (polen, hojas). */
export function particleTexture(): THREE.Texture {
  if (particleTextureCache) return particleTextureCache;
  const canvas = document.createElement('canvas');
  canvas.width = 32;
  canvas.height = 32;
  const ctx = canvas.getContext('2d')!;
  const gradient = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
  gradient.addColorStop(0, 'rgba(255,255,255,1)');
  gradient.addColorStop(0.45, 'rgba(255,255,255,0.75)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 32, 32);
  particleTextureCache = new THREE.CanvasTexture(canvas);
  return particleTextureCache;
}

export function createTree(variant = 0): THREE.Group {
  const g = new THREE.Group();
  const trunk = mesh(geo('trunk', () => new THREE.CylinderGeometry(0.16, 0.22, 1.1, 6)), 0x8a5a3b, [0, 0.55, 0]);
  g.add(trunk);

  const greens = [0x2f8f4e, 0x3aa35c, 0x267a44];
  const leaves = mesh(
    geo('leaves', () => new THREE.IcosahedronGeometry(0.95, 0)),
    greens[variant % greens.length],
    [0, 1.75, 0],
    [1, 1.15, 1],
  );
  g.add(leaves);

  const top = mesh(
    geo('leavestop', () => new THREE.IcosahedronGeometry(0.6, 0)),
    greens[(variant + 1) % greens.length],
    [0.15, 2.5, 0.1],
  );
  g.add(top);

  return g;
}

export function createHouse(width: number, depth: number, wallColor = 0xf3e4c8, roofColor = 0xb4443c): THREE.Group {
  const g = new THREE.Group();
  const h = 2.3;

  const base = mesh(
    new THREE.BoxGeometry(width, h, depth),
    wallColor,
    [0, h / 2, 0],
  );
  g.add(base);

  const roof = mesh(
    new THREE.ConeGeometry(Math.max(width, depth) * 0.78, 1.6, 4),
    roofColor,
    [0, h + 0.8, 0],
  );
  roof.rotation.y = Math.PI / 4;
  g.add(roof);

  const door = mesh(
    new THREE.BoxGeometry(0.8, 1.35, 0.12),
    0x6b4a2f,
    [0, 0.68, depth / 2 + 0.03],
  );
  g.add(door);

  const windowMat = mat(0x9fd8f0, { roughness: 0.2, metalness: 0.1 });
  const winGeo = new THREE.BoxGeometry(0.6, 0.6, 0.1);
  for (const [x, y] of [
    [-width / 3, 1.55],
    [width / 3, 1.55],
  ]) {
    const w = new THREE.Mesh(winGeo, windowMat);
    w.position.set(x, y, depth / 2 + 0.02);
    g.add(w);
  }

  return g;
}

export function createSign(boardColor = 0xa1662f): THREE.Group {
  const g = new THREE.Group();
  g.add(mesh(geo('signpost', () => new THREE.CylinderGeometry(0.07, 0.07, 0.9, 5)), 0x7c4a21, [0, 0.45, 0]));
  g.add(mesh(geo('signboard', () => new THREE.BoxGeometry(0.9, 0.6, 0.1)), boardColor, [0, 1.02, 0]));
  return g;
}

export function createRock(): THREE.Group {
  const g = new THREE.Group();
  const r = mesh(geo('rock', () => new THREE.DodecahedronGeometry(0.65, 0)), 0x8b8f98, [0, 0.45, 0]);
  r.rotation.set(Math.random(), Math.random(), Math.random());
  g.add(r);
  return g;
}

export function createFountain(): THREE.Group {
  const g = new THREE.Group();
  const basin = mesh(geo('basin', () => new THREE.CylinderGeometry(1.7, 1.9, 0.45, 16)), 0xbfc6d4, [0, 0.22, 0]);
  g.add(basin);
  const water = mesh(geo('waterdisc', () => new THREE.CylinderGeometry(1.5, 1.5, 0.1, 16)), 0x4fb6e8, [0, 0.48, 0]);
  water.material = mat(0x4fb6e8, { roughness: 0.1, metalness: 0.2 });
  g.add(water);
  const pillar = mesh(geo('pillar', () => new THREE.CylinderGeometry(0.18, 0.26, 1.2, 8)), 0xd7dce6, [0, 1.0, 0]);
  g.add(pillar);
  const top = mesh(geo('fountaintop', () => new THREE.SphereGeometry(0.34, 10, 8)), 0xe8edf5, [0, 1.75, 0]);
  g.add(top);
  return g;
}

export function createLamp(): THREE.Group {
  const g = new THREE.Group();
  g.add(mesh(geo('lampost', () => new THREE.CylinderGeometry(0.07, 0.1, 2.2, 6)), 0x374151, [0, 1.1, 0]));
  const bulb = mesh(
    geo('lampbulb', () => new THREE.SphereGeometry(0.2, 10, 8)),
    0xfff2b0,
    [0, 2.3, 0],
  );
  bulb.material = mat(0xfff2b0, { emissive: 0xffe680, emissiveIntensity: 1.4 });
  g.add(bulb);
  return g;
}

export function createFence(length: number): THREE.Group {
  const g = new THREE.Group();
  const railGeo = new THREE.BoxGeometry(length, 0.1, 0.08);
  g.add(mesh(railGeo, 0xc9a87c, [0, 0.6, 0]));
  g.add(mesh(railGeo, 0xc9a87c, [0, 1.0, 0]));
  const postGeo = new THREE.BoxGeometry(0.12, 1.1, 0.12);
  for (let i = 0; i <= length; i++) {
    g.add(mesh(postGeo, 0xb08f63, [-length / 2 + i, 0.55, 0]));
  }
  return g;
}

export function createBench(): THREE.Group {
  const g = new THREE.Group();
  const wood = mat(0x9a6b3f, { roughness: 0.9, flatShading: true });
  const seat = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.14, 0.55), wood);
  seat.position.y = 0.55;
  seat.castShadow = true;
  const back = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.5, 0.12), wood);
  back.position.set(0, 0.9, -0.24);
  back.castShadow = true;
  const legGeo = new THREE.BoxGeometry(0.14, 0.55, 0.45);
  const l1 = new THREE.Mesh(legGeo, wood);
  l1.position.set(-0.75, 0.27, 0);
  const l2 = new THREE.Mesh(legGeo, wood);
  l2.position.set(0.75, 0.27, 0);
  g.add(seat, back, l1, l2);
  return g;
}

export function createPlanter(): THREE.Group {
  const g = new THREE.Group();
  const box = new THREE.Mesh(
    new THREE.BoxGeometry(1.3, 0.55, 0.7),
    mat(0xb98a5e, { roughness: 0.95 }),
  );
  box.position.y = 0.28;
  box.castShadow = true;
  box.receiveShadow = true;
  g.add(box);
  const soil = new THREE.Mesh(new THREE.BoxGeometry(1.16, 0.1, 0.56), mat(0x5b3f2a, { roughness: 1 }));
  soil.position.y = 0.56;
  g.add(soil);
  const colors = [0xffd447, 0xff8fab, 0xffffff, 0x9fe8ff];
  for (let i = 0; i < 5; i++) {
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.32, 4), mat(0x4d7c2f));
    stem.position.set(-0.45 + i * 0.22, 0.72, i % 2 === 0 ? 0.1 : -0.12);
    const bloom = new THREE.Mesh(new THREE.SphereGeometry(0.09, 6, 5), mat(colors[i % colors.length]));
    bloom.position.set(stem.position.x, 0.9, stem.position.z);
    g.add(stem, bloom);
  }
  return g;
}

export function createFlower(color: number): THREE.Group {
  const g = new THREE.Group();
  g.add(mesh(geo('stem', () => new THREE.CylinderGeometry(0.02, 0.02, 0.3, 4)), 0x4d7c2f, [0, 0.15, 0]));
  g.add(mesh(geo('petal', () => new THREE.SphereGeometry(0.1, 6, 5)), color, [0, 0.33, 0]));
  return g;
}

export function createPokeball(): THREE.Group {
  const g = new THREE.Group();
  const top = mesh(
    geo('balltop', () => new THREE.SphereGeometry(0.22, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2)),
    0xe23a3a,
    [0, 0, 0],
  );
  const bottom = mesh(
    geo('ballbottom', () => new THREE.SphereGeometry(0.22, 12, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2)),
    0xf8fafc,
    [0, 0, 0],
  );
  const band = mesh(geo('ballband', () => new THREE.CylinderGeometry(0.225, 0.225, 0.06, 16)), 0x1f2937, [0, 0, 0]);
  const button = mesh(geo('ballbutton', () => new THREE.SphereGeometry(0.07, 8, 6)), 0xf8fafc, [0, 0, 0.22]);
  g.add(top, bottom, band, button);
  return g;
}
