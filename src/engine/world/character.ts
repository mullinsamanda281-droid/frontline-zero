import * as THREE from 'three';

export interface SoldierModel {
  group: THREE.Group;
  body: THREE.Mesh;
  head: THREE.Mesh;
  legL: THREE.Group;
  legR: THREE.Group;
  armL: THREE.Group;
  armR: THREE.Group;
  gun: THREE.Mesh;
}

const TEAM_PALETTE = {
  alpha: {
    vest: 0x8a6f4d,
    pant: 0x5c5342,
    helmet: 0x6e5a3a,
    skin: 0xc9a88f,
    gun: 0x22262e,
  },
  bravo: {
    vest: 0x5a6672,
    pant: 0x3f4a54,
    helmet: 0x46525e,
    skin: 0xc9a88f,
    gun: 0x22262e,
  },
} as const;

export function buildSoldier(team: 'alpha' | 'bravo'): SoldierModel {
  const p = TEAM_PALETTE[team];
  const lam = (color: number): THREE.MeshLambertMaterial => new THREE.MeshLambertMaterial({ color });

  const group = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.62, 0.32), lam(p.vest));
  body.position.y = 1.06;
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 0.3), lam(p.skin));
  head.position.y = 1.58;
  const helmet = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.16, 0.36), lam(p.helmet));
  helmet.position.y = 1.76;
  const backpack = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.42, 0.18), lam(p.vest));
  backpack.position.set(0, 1.08, 0.22);

  const limb = (w: number, h: number, d: number, color: number, parent: THREE.Group, y: number): THREE.Mesh => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), lam(color));
    m.position.y = y;
    parent.add(m);
    return m;
  };

  const legL = new THREE.Group();
  legL.position.set(-0.16, 0.9, 0);
  const legR = new THREE.Group();
  legR.position.set(0.16, 0.9, 0);
  limb(0.2, 0.82, 0.24, p.pant, legL, -0.41);
  limb(0.2, 0.82, 0.24, p.pant, legR, -0.41);
  const bootL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.12, 0.3), lam(0x2a2a2a));
  bootL.position.set(0, -0.85, 0.03);
  legL.add(bootL);
  const bootR = bootL.clone();
  legR.add(bootR);

  const armL = new THREE.Group();
  armL.position.set(-0.36, 1.42, 0);
  const armR = new THREE.Group();
  armR.position.set(0.36, 1.42, 0);
  limb(0.16, 0.56, 0.18, p.pant, armL, -0.28);
  limb(0.16, 0.56, 0.18, p.pant, armR, -0.28);
  const handL = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.12, 0.14), lam(p.skin));
  handL.position.set(0, -0.62, 0);
  armL.add(handL);
  const handR = handL.clone();
  armR.add(handR);

  const gun = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.12, 0.62), lam(p.gun));
  gun.position.set(0.16, 1.34, -0.42);
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.3, 8), lam(p.gun));
  barrel.rotation.x = Math.PI / 2;
  barrel.position.set(0.16, 1.36, -0.75);
  gun.add(barrel);

  group.add(body, head, helmet, backpack, legL, legR, armL, armR, gun);
  return { group, body, head, legL, legR, armL, armR, gun };
}

export function animateSoldier(
  model: SoldierModel,
  phase: number,
  moving: boolean,
  aiming: boolean,
): void {
  const swing = moving ? Math.sin(phase) * 0.62 : 0;
  model.legL.rotation.x = swing;
  model.legR.rotation.x = -swing;
  const armSwing = moving ? Math.sin(phase + Math.PI) * 0.5 : 0;
  const aim = aiming ? 0.85 : 0;
  model.armL.rotation.x = armSwing + aim * 0.4;
  model.armR.rotation.x = -armSwing * 0.7 + aim;
  model.armR.rotation.z = aiming ? -0.25 : 0;
  model.armL.rotation.z = aiming ? 0.12 : 0;
  const bob = moving ? Math.abs(Math.sin(phase)) * 0.05 : Math.sin(phase * 0.5) * 0.01;
  model.group.position.y = bob;
}
