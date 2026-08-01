export type BoxKind = 'container' | 'containerDark' | 'warehouse' | 'crane';

export interface Box {
  x: number;
  z: number;
  w: number;
  h: number;
  d: number;
  kind?: BoxKind;
}

export const PLACEMENTS_DESERT: Box[] = [
  { x: -8, z: -12, w: 4, h: 3, d: 8 },
  { x: 8, z: -10, w: 4, h: 3, d: 8 },
  { x: 0, z: -20, w: 8, h: 4, d: 4 },
  { x: -15, z: -5, w: 5, h: 2, d: 5 },
  { x: 15, z: 5, w: 5, h: 2, d: 5 },
  { x: -5, z: 10, w: 10, h: 6, d: 3 },
  { x: 20, z: -15, w: 3, h: 2.5, d: 6 },
  { x: -20, z: 15, w: 3, h: 2.5, d: 6 },
  { x: 5, z: -35, w: 6, h: 5, d: 3 },
  { x: -25, z: -20, w: 3, h: 2.5, d: 6 },
  { x: 25, z: 20, w: 3, h: 2.5, d: 6 },
  { x: -10, z: 30, w: 3, h: 2.5, d: 6 },
  { x: 30, z: -5, w: 3, h: 2.5, d: 6 },
  { x: -30, z: -10, w: 6, h: 1.2, d: 3 },
  { x: 30, z: 10, w: 6, h: 1.2, d: 3 },
  { x: 0, z: 0, w: 14, h: 6, d: 10, kind: 'warehouse' },
  { x: -30, z: -30, w: 14, h: 6, d: 10, kind: 'warehouse' },
  { x: -10, z: -40, w: 2, h: 12, d: 2, kind: 'crane' },
  { x: 10, z: -40, w: 2, h: 12, d: 2, kind: 'crane' },
  { x: 0, z: -36, w: 24, h: 2, d: 2, kind: 'crane' },
];

export const PLACEMENTS_INDUSTRY: Box[] = [
  { x: -6, z: -8, w: 5, h: 4, d: 5 },
  { x: 6, z: -6, w: 5, h: 4, d: 5 },
  { x: 0, z: -18, w: 10, h: 3, d: 4 },
  { x: -12, z: 0, w: 4, h: 2.5, d: 6 },
  { x: 12, z: 2, w: 4, h: 2.5, d: 6 },
  { x: -4, z: 8, w: 3, h: 2.5, d: 6 },
  { x: 4, z: 10, w: 3, h: 2.5, d: 6 },
  { x: 20, z: -10, w: 6, h: 5, d: 3 },
  { x: -20, z: -8, w: 6, h: 5, d: 3 },
  { x: 0, z: -30, w: 3, h: 2.5, d: 6 },
  { x: -8, z: -28, w: 3, h: 2.5, d: 6 },
  { x: 8, z: -30, w: 3, h: 2.5, d: 6 },
  { x: 14, z: 14, w: 3, h: 2.5, d: 6 },
  { x: -14, z: 12, w: 3, h: 2.5, d: 6 },
  { x: -30, z: -20, w: 3, h: 2.5, d: 6 },
  { x: 30, z: -18, w: 3, h: 2.5, d: 6 },
  { x: 0, z: 25, w: 6, h: 1.2, d: 3 },
  { x: -25, z: 0, w: 6, h: 1.2, d: 3 },
  { x: 25, z: 0, w: 6, h: 1.2, d: 3 },
  { x: 0, z: -40, w: 14, h: 6, d: 10, kind: 'warehouse' },
  { x: -35, z: 5, w: 14, h: 6, d: 10, kind: 'warehouse' },
  { x: -15, z: -35, w: 2, h: 10, d: 2, kind: 'crane' },
  { x: 15, z: -35, w: 2, h: 10, d: 2, kind: 'crane' },
  { x: 0, z: -32, w: 34, h: 2, d: 2, kind: 'crane' },
];

export const PLACEMENTS: Box[] = [
  { x: -6, z: -10, w: 3, h: 2.5, d: 6 },
  { x: 6, z: -8, w: 3, h: 2.5, d: 6 },
  { x: 10, z: -18, w: 3, h: 2.5, d: 6 },
  { x: -12, z: -16, w: 3, h: 2.5, d: 6 },
  { x: 0, z: -24, w: 6, h: 5, d: 3, kind: 'containerDark' },
  { x: -20, z: -6, w: 6, h: 1.2, d: 3 },
  { x: 16, z: 4, w: 6, h: 1.2, d: 3 },
  { x: -4, z: 8, w: 3, h: 2.5, d: 6 },
  { x: 22, z: -12, w: 6, h: 5, d: 3, kind: 'containerDark' },
  { x: -30, z: -28, w: 3, h: 2.5, d: 6 },
  { x: -26, z: -40, w: 3, h: 2.5, d: 6 },
  { x: 28, z: -30, w: 3, h: 2.5, d: 6 },
  { x: 34, z: -16, w: 3, h: 2.5, d: 6 },
  { x: 30, z: 14, w: 3, h: 2.5, d: 6 },
  { x: -34, z: 12, w: 3, h: 2.5, d: 6 },
  { x: -30, z: 30, w: 6, h: 1.2, d: 3 },
  { x: 18, z: 26, w: 6, h: 1.2, d: 3 },
  { x: -14, z: 30, w: 3, h: 2.5, d: 6 },
  { x: 8, z: -44, w: 3, h: 2.5, d: 6 },
  { x: -8, z: -50, w: 6, h: 5, d: 3, kind: 'containerDark' },
  { x: 0, z: -60, w: 14, h: 6, d: 10, kind: 'warehouse' },
  { x: 44, z: -44, w: 14, h: 6, d: 10, kind: 'warehouse' },
  { x: -44, z: 44, w: 14, h: 6, d: 10, kind: 'warehouse' },
  { x: 0, z: 44, w: 14, h: 6, d: 10, kind: 'warehouse' },
  { x: -10, z: -70, w: 2, h: 14, d: 2, kind: 'crane' },
  { x: 10, z: -70, w: 2, h: 14, d: 2, kind: 'crane' },
  { x: 0, z: -66, w: 28, h: 2, d: 2, kind: 'crane' },
  { x: 40, z: -70, w: 2, h: 14, d: 2, kind: 'crane' },
  { x: 42, z: -66, w: 16, h: 2, d: 2, kind: 'crane' },
];
