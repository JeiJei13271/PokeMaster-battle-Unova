import * as THREE from 'three';
import type { Species } from '../types';

/**
 * Sprites de criatura 100 % procedurales, con estética de overworld:
 * silueta redondeada, contorno, sombreado y dos frames de paso.
 * No se usan los PNG estáticos de batalla del juego original.
 */

const ART = 40;
const PIXEL = 4;
const textureCache = new Map<string, THREE.Texture>();
const portraitCache = new Map<string, string>();

function hex(value: number): string {
  return `#${value.toString(16).padStart(6, '0')}`;
}

function mix(value: number, target: number, amount: number): number {
  return new THREE.Color(value).lerp(new THREE.Color(target), amount).getHex();
}

interface Colors {
  body: string;
  accent: string;
  light: string;
  dark: string;
  outline: string;
  eye: string;
}

function paletteOf(sp: Species): Colors {
  return {
    body: hex(sp.body),
    accent: hex(sp.accent),
    light: hex(mix(sp.body, 0xffffff, 0.42)),
    dark: hex(mix(sp.body, 0x000000, 0.3)),
    outline: hex(mix(sp.body, 0x000000, 0.6)),
    eye: '#171722',
  };
}

type Painter = {
  ellipse: (cx: number, cy: number, rx: number, ry: number, color: string) => void;
  rect: (x: number, y: number, w: number, h: number, color: string) => void;
  tri: (x1: number, y1: number, x2: number, y2: number, x3: number, y3: number, color: string) => void;
  poly: (points: [number, number][], color: string) => void;
};

function makePainter(ctx: CanvasRenderingContext2D): Painter {
  const plot = (x: number, y: number, color: string): void => {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, 1, 1);
  };
  const inPoly = (x: number, y: number, points: [number, number][]): boolean => {
    let inside = false;
    for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
      const [xi, yi] = points[i];
      const [xj, yj] = points[j];
      if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  };

  return {
    ellipse(cx, cy, rx, ry, color) {
      for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
        for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
          const nx = (x + 0.5 - cx) / rx;
          const ny = (y + 0.5 - cy) / ry;
          if (nx * nx + ny * ny <= 1) plot(x, y, color);
        }
      }
    },
    rect(x, y, w, h, color) {
      ctx.fillStyle = color;
      ctx.fillRect(x, y, w, h);
    },
    tri(x1, y1, x2, y2, x3, y3, color) {
      const minX = Math.floor(Math.min(x1, x2, x3));
      const maxX = Math.ceil(Math.max(x1, x2, x3));
      const minY = Math.floor(Math.min(y1, y2, y3));
      const maxY = Math.ceil(Math.max(y1, y2, y3));
      for (let y = minY; y <= maxY; y++) {
        for (let x = minX; x <= maxX; x++) {
          if (inPoly(x + 0.5, y + 0.5, [[x1, y1], [x2, y2], [x3, y3]])) plot(x, y, color);
        }
      }
    },
    poly(points, color) {
      const xs = points.map((p) => p[0]);
      const ys = points.map((p) => p[1]);
      for (let y = Math.floor(Math.min(...ys)); y <= Math.ceil(Math.max(...ys)); y++) {
        for (let x = Math.floor(Math.min(...xs)); x <= Math.ceil(Math.max(...xs)); x++) {
          if (inPoly(x + 0.5, y + 0.5, points)) plot(x, y, color);
        }
      }
    },
  };
}

function drawCreature(
  ctx: CanvasRenderingContext2D,
  sp: Species,
  back: boolean,
  frame: number,
): void {
  const c = paletteOf(sp);
  const p = makePainter(ctx);
  const lift = frame === 1 ? 1 : 0;
  ctx.clearRect(0, 0, ART, ART);
  ctx.imageSmoothingEnabled = false;

  /** Silueta con contorno: dibuja una forma un píxel mayor en outline. */
  const outlined = (
    draw: (grow: number, color: string) => void,
    fill: string,
  ): void => {
    draw(1.2, c.outline);
    draw(0, fill);
  };

  const eyes = (x1: number, x2: number, y: number, accent = false): void => {
    if (back) return;
    for (const x of [x1, x2]) {
      p.rect(x, y, 2, 2, '#ffffff');
      p.rect(x + 1, y + 1, 1, 1, accent ? c.accent : c.eye);
    }
  };

  if (sp.shape === 'serpent') {
    // Base enrollada.
    ctx.fillStyle = c.outline;
    ctx.beginPath();
    ctx.ellipse(20, 33.5, 13.5, 4.4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = c.dark;
    ctx.beginPath();
    ctx.ellipse(20, 33, 12, 3.1, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = c.light;
    ctx.beginPath();
    ctx.ellipse(20, 32.6, 7, 1.3, 0, 0, Math.PI * 2);
    ctx.fill();

    // Cuerpo en S con contorno y brillo.
    const bodyPath = (): void => {
      ctx.beginPath();
      ctx.moveTo(28, 32);
      ctx.bezierCurveTo(17, 31, 16, 24, 21, 20);
      ctx.bezierCurveTo(25, 17, 23, 15, 22, 13);
    };
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = c.outline;
    ctx.lineWidth = 9;
    bodyPath();
    ctx.stroke();
    ctx.strokeStyle = c.body;
    ctx.lineWidth = 6.4;
    bodyPath();
    ctx.stroke();
    ctx.strokeStyle = c.light;
    ctx.lineWidth = 1.8;
    bodyPath();
    ctx.stroke();

    // Hoja de la cola.
    outlined(() => p.poly([[7, 14], [13, 7], [17, 12], [12, 19]], c.accent), c.accent);
    p.rect(12, 12, 2, 1, c.light);

    // Cabeza con hocico.
    outlined((g) => p.ellipse(24, 12, 7.5 + g, 6 + g, c.body), c.body);
    p.ellipse(25, 14, 5, 3, c.light);
    outlined((g) => p.ellipse(29, 15, 2.4 + g, 1.8 + g, c.body), c.body);
    if (back) {
      p.ellipse(24, 11, 6, 4, c.dark);
    } else {
      eyes(21, 26, 11);
      p.rect(29, 15, 1, 1, c.eye);
    }
    p.ellipse(18, 19, 1.6, 3, c.body);
  } else if (sp.shape === 'biped') {
    // Cuerpo y piernas.
    outlined((g) => p.ellipse(20, 29, 9 + g, 10 + g, c.body), c.body);
    p.ellipse(20, 30, 5.5, 7, c.light);
    p.ellipse(20, 28, 4.2, 5.2, c.accent);
    p.ellipse(20, 28, 2.6, 3.4, c.light);
    p.rect(12, 35, 5, 4 - lift, c.dark);
    p.rect(23, 35, 5, 4 - (frame === 1 ? 0 : 1), c.dark);
    // Brazos.
    p.ellipse(10, 27, 2.2, 4.5, c.outline);
    p.ellipse(30, 27, 2.2, 4.5, c.outline);
    p.ellipse(10, 27, 1.4, 3.6, c.body);
    p.ellipse(30, 27, 1.4, 3.6, c.body);
    // Cabeza y orejas.
    outlined((g) => p.ellipse(20, 14, 8 + g, 7 + g, c.body), c.body);
    p.ellipse(20, 16, 5.5, 3.5, c.light);
    outlined((g) => p.ellipse(11, 9, 3 + g, 2.5 + g, c.accent), c.accent);
    outlined((g) => p.ellipse(29, 9, 3 + g, 2.5 + g, c.accent), c.accent);
    if (back) {
      p.ellipse(20, 13, 6.5, 5, c.dark);
    } else {
      eyes(16, 22, 13);
      p.rect(19, 17, 2, 1, c.eye);
    }
  } else if (sp.shape === 'orb') {
    const flying = sp.types.includes('flying');
    if (flying) {
      // Pájaro redondo con alas.
      outlined((g) => p.ellipse(20, 27, 10 + g, 8 + g, c.body), c.body);
      p.ellipse(20, 29, 6, 5, c.light);
      outlined((g) => p.ellipse(9, 25 + lift, 5 + g, 3.5 + g, c.dark), c.dark);
      outlined((g) => p.ellipse(31, 25 + (1 - lift), 5 + g, 3.5 + g, c.dark), c.dark);
      outlined((g) => p.ellipse(20, 14, 7 + g, 6.5 + g, c.body), c.body);
      p.ellipse(20, 16, 5, 3, c.light);
      p.tri(19, 16, 23, 17, 19, 19, c.accent);
      p.rect(17, 36, 2, 2, c.outline);
      p.rect(23, 36, 2, 2, c.outline);
      p.tri(10, 30, 15, 29, 12, 36, c.dark);
      if (back) p.ellipse(20, 13, 6, 4.5, c.dark);
      else eyes(16, 22, 12);
    } else {
      // Roca angular con cristal.
      outlined((g) => p.poly([[10 - g, 30], [8 - g, 22], [13 - g, 14], [24 - g, 11], [32 + g, 18], [33 + g, 30], [27 + g, 35], [14 + g, 35]], c.body), c.body);
      p.poly([[12, 27], [12, 21], [16, 15], [24, 14], [29, 19], [29, 27], [24, 31], [16, 31]], c.dark);
      p.poly([[14, 20], [18, 16], [20, 22], [16, 26]], c.light);
      outlined((g) => p.poly([[25, 10], [29, 4], [31, 12]], c.accent), c.accent);
      outlined((g) => p.poly([[9, 23], [5, 19], [12, 18]], c.accent), c.accent);
      if (!back) {
        p.rect(16, 21, 2, 2, '#ffffff');
        p.rect(24, 21, 2, 2, '#ffffff');
        p.rect(17, 22, 1, 1, c.eye);
        p.rect(25, 22, 1, 1, c.eye);
        p.rect(19, 26, 5, 1, c.eye);
      } else {
        p.poly([[14, 16], [23, 13], [28, 18], [25, 22], [16, 23]], c.dark);
      }
    }
  } else {
    // Cuadrúpedos.
    const pig = sp.id === 'tepig';
    const dog = sp.id === 'lillipup';
    const cat = sp.id === 'purrloin';
    const rat = sp.id === 'patrat';
    const zebra = sp.id === 'blitzle';
    const rock = sp.types.includes('rock');

    // Cola.
    if (rat) {
      for (let i = 0; i < 6; i++) p.rect(30 + i, 27 - Math.floor(i * 0.7), 2, 1, c.dark);
    } else if (cat) {
      for (let i = 0; i < 5; i++) p.rect(30 + i, 26 - i, 2, 2, c.dark);
      p.rect(35, 20, 2, 2, c.accent);
    } else if (!rock) {
      outlined((g) => p.ellipse(32, 26, 4 + g, 2.4 + g, c.dark), c.dark);
    }

    // Patas.
    p.rect(11, 34, 4, 5 - lift, c.outline);
    p.rect(12, 34, 2, 4 - lift, c.dark);
    p.rect(17, 35, 4, 4, c.outline);
    p.rect(24, 34, 4, 5 - (frame === 1 ? 0 : 1), c.outline);
    p.rect(25, 34, 2, 4, c.dark);

    // Cuerpo.
    if (rock) {
      outlined((g) => p.poly([[8 - g, 31], [7 - g, 23], [12 - g, 16], [25 - g, 15], [33 + g, 22], [32 + g, 32], [24 + g, 36], [13 + g, 35]], c.body), c.body);
      p.poly([[10, 27], [10, 22], [14, 18], [25, 18], [30, 23], [29, 30], [23, 33], [14, 32]], c.dark);
      p.poly([[12, 23], [17, 19], [19, 24], [15, 28]], c.light);
      outlined((g) => p.poly([[27, 17], [31, 11], [33, 18]], c.accent), c.accent);
      p.rect(13, 28, 6, 2, c.accent);
      p.rect(22, 29, 5, 2, c.accent);
    } else {
      outlined((g) => p.ellipse(20, 27, 12 + g, 8 + g, c.body), c.body);
      p.ellipse(20, 29, 8, 5, c.light);
      if (zebra) {
        for (const x of [12, 17, 22, 27]) p.rect(x, 21, 2, 8, c.accent);
      }
      if (pig) p.ellipse(20, 26, 7, 4, c.dark);
    }

    // Cabeza.
    outlined((g) => p.ellipse(20, 15, 8.5 + g, 7.5 + g, c.body), c.body);
    p.ellipse(20, 17, 5.5, 3.5, c.light);

    if (cat) {
      outlined((g) => p.tri(12 - g, 12, 14 - g, 4 - g, 19, 9, c.body), c.body);
      outlined((g) => p.tri(28 + g, 12, 26 + g, 4 - g, 21, 9, c.body), c.body);
      p.tri(14, 10, 15, 6, 18, 9, c.accent);
      p.tri(26, 10, 25, 6, 22, 9, c.accent);
    } else if (zebra) {
      p.tri(13, 13, 14, 5, 18, 10, c.accent);
      p.tri(27, 13, 26, 5, 22, 10, c.accent);
      for (let i = 0; i < 3; i++) p.rect(12 + i * 2, 9 - i, 2, 3, c.accent);
    } else if (dog) {
      outlined((g) => p.ellipse(12, 13, 3 + g, 5 + g, c.dark), c.dark);
      outlined((g) => p.ellipse(28, 13, 3 + g, 5 + g, c.dark), c.dark);
      p.ellipse(20, 18, 4.5, 2.6, c.accent);
    } else if (!rock) {
      outlined((g) => p.ellipse(12, 9, 3 + g, 2.5 + g, c.dark), c.dark);
      outlined((g) => p.ellipse(28, 9, 3 + g, 2.5 + g, c.dark), c.dark);
    }

    if (pig) {
      p.ellipse(20, 18, 4, 2.6, c.accent);
      p.rect(18, 18, 1, 1, c.body);
      p.rect(22, 18, 1, 1, c.body);
    } else if (rat) {
      p.ellipse(12, 18, 3.2, 2.2, c.accent);
      p.ellipse(28, 18, 3.2, 2.2, c.accent);
    } else if (rock) {
      p.rect(15, 13, 3, 3, c.accent);
      p.rect(22, 14, 2, 3, c.accent);
    }

    if (back) {
      p.ellipse(20, 14, 7, 5, c.dark);
    } else {
      eyes(16, 22, 14, cat);
      p.rect(19, 19, 2, 1, c.eye);
    }
  }
}

function canvasFor(sp: Species, back: boolean, frame: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = ART * PIXEL;
  canvas.height = ART * PIXEL;
  const ctx = canvas.getContext('2d')!;
  ctx.scale(PIXEL, PIXEL);
  drawCreature(ctx, sp, back, frame);
  return canvas;
}

export function creatureTexture(sp: Species, back: boolean, frame: number): THREE.Texture {
  const key = `${sp.id}-${back ? 'b' : 'f'}-${frame}`;
  const cached = textureCache.get(key);
  if (cached) return cached;
  const texture = new THREE.CanvasTexture(canvasFor(sp, back, frame));
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.generateMipmaps = false;
  textureCache.set(key, texture);
  return texture;
}

/** Retrato para el HUD (misma estética). */
export function creaturePortrait(sp: Species): string {
  const cached = portraitCache.get(sp.id);
  if (cached) return cached;
  const url = canvasFor(sp, false, 0).toDataURL('image/png');
  portraitCache.set(sp.id, url);
  return url;
}
