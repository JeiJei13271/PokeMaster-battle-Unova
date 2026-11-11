import * as THREE from 'three';
import type { CharacterPalette, CharacterRig } from './models';

/**
 * Sprites pixel art para el mundo, al estilo de PBA / Pokémon Reloaded:
 * se dibujan por código (16×20 px) para no depender de arte externo y se
 * pegan como billboard sobre el rig 3D, que queda oculto salvo su sombra.
 */

export type OverworldFacing = 'down' | 'up' | 'left' | 'right';

const ART_W = 16;
const ART_H = 20;
const SCALE = 2;

const textureCache = new Map<string, THREE.Texture>();

interface SpriteBinding {
  sprite: THREE.Sprite;
  palette: CharacterPalette;
  key: string;
  phase: number;
}

const bindings = new WeakMap<THREE.Object3D, SpriteBinding>();

function hex(value: number): string {
  return `#${value.toString(16).padStart(6, '0')}`;
}

function mix(value: number, target: number, amount: number): number {
  const a = new THREE.Color(value);
  a.lerp(new THREE.Color(target), amount);
  return a.getHex();
}

function paletteKey(p: CharacterPalette): string {
  return [p.skin, p.hair, p.shirt, p.pants, p.accent ?? 0].join('-');
}

function drawCharacter(
  ctx: CanvasRenderingContext2D,
  p: CharacterPalette,
  facing: OverworldFacing,
  frame: number,
): void {
  const outline = '#241c2b';
  const skin = hex(p.skin);
  const hair = hex(p.hair);
  const shirt = hex(p.shirt);
  const pants = hex(p.pants);
  const accent = hex(p.accent ?? mix(p.shirt, 0xffffff, 0.25));
  const shoe = '#2c2f3a';
  const eye = '#1b1b24';

  ctx.clearRect(0, 0, ART_W, ART_H);
  ctx.imageSmoothingEnabled = false;

  const rect = (x: number, y: number, w: number, h: number, color: string): void => {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, h);
  };

  const leftLift = frame === 1 ? 1 : 0;
  const rightLift = frame === 1 ? 0 : 1;

  // Silueta / contorno.
  rect(3, 1, 10, 9, outline);
  rect(3, 9, 10, 6, outline);
  rect(4, 14, 4, 5, outline);
  rect(8, 14, 4, 5, outline);

  // Piernas y zapatos.
  rect(4, 14, 3, 4 - leftLift, pants);
  rect(9, 14, 3, 4 - rightLift, pants);
  rect(4, 18 - leftLift, 3, 1, shoe);
  rect(9, 18 - rightLift, 3, 1, shoe);

  // Torso.
  rect(4, 9, 8, 5, shirt);
  rect(4, 12, 8, 1, accent);

  // Brazos.
  rect(2, 9, 2, 4, skin);
  rect(12, 9, 2, 4, skin);

  if (facing === 'down') {
    rect(4, 2, 8, 7, skin);
    rect(4, 2, 8, 2, hair);
    rect(4, 4, 8, 1, hair);
    rect(3, 3, 1, 3, hair);
    rect(12, 3, 1, 3, hair);
    rect(6, 6, 1, 2, eye);
    rect(9, 6, 1, 2, eye);
  } else if (facing === 'up') {
    rect(4, 2, 8, 8, hair);
    rect(4, 8, 8, 2, shirt);
    rect(4, 9, 8, 1, hex(mix(p.hair, 0x000000, 0.18)));
  } else {
    const flip = facing === 'right';
    const faceX = flip ? 8 : 4;
    const hairX = flip ? 4 : 10;
    rect(4, 2, 8, 8, skin);
    rect(hairX, 2, 2, 7, hair);
    rect(4, 2, 8, 2, hair);
    rect(faceX + (flip ? 1 : 0), 6, 1, 2, eye);
    rect(faceX + (flip ? 3 : 2), 8, 1, 1, skin);
  }
}

function textureFor(p: CharacterPalette, facing: OverworldFacing, frame: number): THREE.Texture {
  const key = `${paletteKey(p)}-${facing}-${frame}`;
  const cached = textureCache.get(key);
  if (cached) return cached;

  const canvas = document.createElement('canvas');
  canvas.width = ART_W * SCALE;
  canvas.height = ART_H * SCALE;
  const ctx = canvas.getContext('2d')!;
  ctx.scale(SCALE, SCALE);
  drawCharacter(ctx, p, facing, frame);

  const texture = new THREE.CanvasTexture(canvas);
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.generateMipmaps = false;
  textureCache.set(key, texture);
  return texture;
}

/** Añade el sprite al rig y oculta su cuerpo 3D (la sombra se conserva). */
export function attachOverworldSprite(rig: CharacterRig, palette: CharacterPalette): void {
  rig.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (mesh.isMesh && mesh.name !== 'contact-shadow') mesh.visible = false;
  });

  const material = new THREE.SpriteMaterial({
    map: textureFor(palette, 'down', 0),
    transparent: true,
    alphaTest: 0.5,
    depthWrite: true,
  });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(1.05, 1.3125, 1);
  sprite.position.y = 0.66;
  rig.add(sprite);

  bindings.set(rig, {
    sprite,
    palette,
    key: `${paletteKey(palette)}-down-0`,
    phase: Math.random() * Math.PI * 2,
  });
}

export function facingFromYaw(yaw: number): OverworldFacing {
  const a = Math.atan2(Math.sin(yaw), Math.cos(yaw));
  if (a > (Math.PI * 3) / 4 || a < (-Math.PI * 3) / 4) return 'down';
  if (a > Math.PI / 4) return 'right';
  if (a < -Math.PI / 4) return 'left';
  return 'up';
}

export function updateOverworldSprite(
  rig: CharacterRig,
  facing: OverworldFacing,
  frame: number,
  time = 0,
  moving = false,
): void {
  const binding = bindings.get(rig);
  if (!binding) return;
  const key = `${paletteKey(binding.palette)}-${facing}-${frame}`;
  if (key !== binding.key) {
    binding.key = key;
    binding.sprite.material.map = textureFor(binding.palette, facing, frame);
    binding.sprite.material.needsUpdate = true;
  }
  // Respiración al estar quieto y pequeño rebote al caminar.
  const bob = moving
    ? Math.abs(Math.sin(time * 9)) * 0.03
    : Math.sin(time * 1.6 + binding.phase) * 0.012;
  binding.sprite.position.y = 0.66 + bob;
}
