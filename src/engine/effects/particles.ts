import * as THREE from 'three';
import { ObjectPool } from '../perf/objectPool';

interface Particle {
  vx: number;
  vy: number;
  vz: number;
  life: number;
  maxLife: number;
  startScale: number;
  endScale: number;
  mesh: THREE.Mesh;
  mat: THREE.MeshLambertMaterial;
}

const MAX_PARTICLES = 28;

export class ParticleSystem {
  private readonly pool: ObjectPool<THREE.Mesh>;
  private readonly particles: Particle[] = [];
  private sharedGeos: THREE.SphereGeometry | null = null;

  constructor(scene: THREE.Scene) {
    this.pool = new ObjectPool<THREE.Mesh>(
      () => {
        if (!this.sharedGeos) {
          this.sharedGeos = new THREE.SphereGeometry(1, 8, 6);
        }
        const mat = new THREE.MeshLambertMaterial({
          color: 0xffffff,
          transparent: true,
          opacity: 1,
        });
        const mesh = new THREE.Mesh(this.sharedGeos, mat) as unknown as THREE.Mesh;
        mesh.visible = false;
        scene.add(mesh);
        return mesh;
      },
      (mesh) => {
        mesh.visible = false;
      },
      MAX_PARTICLES,
    );
  }

  spawnSmoke(x: number, y: number, z: number): void {
    const p = this.acquire(0x8a8a8a, 0.14, 0.42);
    if (!p) return;
    p.vx = (Math.random() - 0.5) * 0.6;
    p.vy = 1.4;
    p.vz = (Math.random() - 0.5) * 0.6;
    p.maxLife = 0.55;
    p.life = p.maxLife;
    p.mesh.position.set(x, y, z);
    p.mat.opacity = 0.45;
  }

  spawnSpark(x: number, y: number, z: number): void {
    for (let i = 0; i < 3; i++) {
      const p = this.acquire(i % 2 === 0 ? 0xffd27a : 0xfff2c8, 0.035, 0.05);
      if (!p) return;
      p.vx = (Math.random() - 0.5) * 7;
      p.vy = Math.random() * 4;
      p.vz = (Math.random() - 0.5) * 7;
      p.maxLife = 0.18;
      p.life = p.maxLife;
      p.mesh.position.set(x, y, z);
      p.mat.opacity = 0.95;
    }
  }

  private acquire(color: number, startScale: number, endScale: number): Particle | null {
    const mesh = this.pool.acquire();
    mesh.visible = true;
    const mat = mesh.material as THREE.MeshLambertMaterial;
    mat.color.setHex(color);
    mat.opacity = 0;
    mesh.scale.setScalar(startScale);
    const particle: Particle = {
      vx: 0,
      vy: 0,
      vz: 0,
      life: 0.3,
      maxLife: 0.3,
      startScale,
      endScale,
      mesh,
      mat,
    };
    this.particles.push(particle);
    if (this.particles.length > MAX_PARTICLES) {
      const oldest = this.particles.shift();
      if (oldest) this.release(oldest);
    }
    return particle;
  }

  private release(p: Particle): void {
    p.mat.opacity = 0;
    this.pool.release(p.mesh);
    const idx = this.particles.indexOf(p);
    if (idx !== -1) this.particles.splice(idx, 1);
  }

  update(dt: number): void {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.release(p);
        continue;
      }
      p.mesh.position.x += p.vx * dt;
      p.mesh.position.y += p.vy * dt;
      p.mesh.position.z += p.vz * dt;
      p.vy -= 4 * dt;
      const t = 1 - p.life / p.maxLife;
      p.mesh.scale.setScalar(p.startScale + (p.endScale - p.startScale) * t);
      p.mat.opacity = Math.max(0, 1 - t) * (p.startScale > 0.1 ? 0.45 : 0.95);
    }
  }

  clear(): void {
    for (let i = this.particles.length - 1; i >= 0; i--) this.release(this.particles[i]);
  }
}
