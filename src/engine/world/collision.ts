import { Vec3 } from '../camera/vec3';

export interface AABB {
  minX: number;
  minY: number;
  minZ: number;
  maxX: number;
  maxY: number;
  maxZ: number;
}

export function makeAABB(cx: number, cy: number, cz: number, w: number, h: number, d: number): AABB {
  return {
    minX: cx - w / 2,
    minY: cy - h / 2,
    minZ: cz - d / 2,
    maxX: cx + w / 2,
    maxY: cy + h / 2,
    maxZ: cz + d / 2,
  };
}

export class CollisionWorld {
  constructor(readonly boxes: AABB[]) {}

  raycast(origin: Vec3, direction: Vec3, maxDist: number): number | null {
    let best = maxDist;
    let hit = false;
    for (const box of this.boxes) {
      let tMin = 0;
      let tMax = maxDist;
      let valid = true;

      for (const axis of ['x', 'y', 'z'] as const) {
        const o = origin[axis];
        const d = direction[axis];
        const lo = box[`min${axis.toUpperCase()}` as 'minX' | 'minY' | 'minZ'];
        const hi = box[`max${axis.toUpperCase()}` as 'maxX' | 'maxY' | 'maxZ'];
        if (Math.abs(d) < 1e-9) {
          if (o < lo || o > hi) {
            valid = false;
            break;
          }
        } else {
          let t1 = (lo - o) / d;
          let t2 = (hi - o) / d;
          if (t1 > t2) [t1, t2] = [t2, t1];
          tMin = Math.max(tMin, t1);
          tMax = Math.min(tMax, t2);
          if (tMin > tMax) {
            valid = false;
            break;
          }
        }
      }

      if (valid && tMin > 0 && tMin < best) {
        best = tMin;
        hit = true;
      }
    }
    return hit ? best : null;
  }

  heightAt(x: number, z: number): number {
    let top = 0;
    for (const box of this.boxes) {
      if (x >= box.minX && x <= box.maxX && z >= box.minZ && z <= box.maxZ) {
        top = Math.max(top, box.maxY);
      }
    }
    return top;
  }

  resolveCapsule(
    pos: Vec3,
    radius: number,
    height: number,
  ): { floorY: number; penetration: boolean } {
    let floorY = 0;
    let penetration = false;

    for (const box of this.boxes) {
      const closestX = Math.max(box.minX, Math.min(pos.x, box.maxX));
      const closestZ = Math.max(box.minZ, Math.min(pos.z, box.maxZ));
      const dx = pos.x - closestX;
      const dz = pos.z - closestZ;
      const distSq = dx * dx + dz * dz;

      if (pos.y >= box.maxY && pos.y - box.maxY <= 0.35 && distSq <= radius * radius) {
        floorY = Math.max(floorY, box.maxY);
        continue;
      }

      if (distSq < radius * radius) {
        const feet = pos.y;
        const head = pos.y + height;
        if (feet < box.maxY && head > box.minY) {
          penetration = true;
          const dist = Math.sqrt(distSq);
          const overlap = radius - dist;
          if (dist > 1e-6) {
            pos.x += (dx / dist) * overlap;
            pos.z += (dz / dist) * overlap;
          } else {
            pos.x += overlap;
          }
        }
      }
    }

    return { floorY, penetration };
  }
}
