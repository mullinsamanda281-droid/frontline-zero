export type BoxKind = 'container' | 'containerDark' | 'warehouse' | 'crane';

export interface Box {
  x: number;
  z: number;
  w: number;
  h: number;
  d: number;
  kind?: BoxKind;
}

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
