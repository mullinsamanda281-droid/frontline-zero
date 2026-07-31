import * as THREE from 'three';
import { type WeaponClass } from './weaponData';

const PALETTE: Record<WeaponClass, number> = {
  ar: 0x3a4148,
  smg: 0x565c63,
  marksman: 0x4d5a43,
  sniper: 0x2f3a52,
  shotgun: 0x6b4a2f,
  sidearm: 0x44484e,
};

export interface WeaponModel {
  group: THREE.Group;
  flash: THREE.Group;
}

export function buildWeaponModel(cls: WeaponClass): WeaponModel {
  const group = new THREE.Group();
  const material = new THREE.MeshLambertMaterial({ color: PALETTE[cls] });
  const dark = new THREE.MeshLambertMaterial({ color: 0x1d2126 });

  const box = (w: number, h: number, d: number, x: number, y: number, z: number, mat = material): THREE.Mesh => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    mesh.position.set(x, y, z);
    group.add(mesh);
    return mesh;
  };

  const barrel = (length: number, x = 0, y = 0.03, z = -0.55, radius = 0.022): void => {
    const mesh = new THREE.Mesh(
      new THREE.CylinderGeometry(radius, radius, length, 8),
      dark,
    );
    mesh.rotation.x = Math.PI / 2;
    mesh.position.set(x, y, z - length / 2);
    group.add(mesh);
  };

  const sight = (x = 0, y = 0.14, z = -0.22): void => {
    box(0.03, 0.06, 0.12, x, y, z, dark);
  };

  switch (cls) {
    case 'ar':
      box(0.07, 0.11, 0.5, 0, 0, -0.05);
      box(0.05, 0.09, 0.18, 0, -0.05, 0.24);
      box(0.06, 0.1, 0.09, 0, -0.08, -0.12, dark);
      box(0.04, 0.14, 0.07, 0, -0.1, 0.02, dark);
      barrel(0.5);
      sight();
      box(0.05, 0.04, 0.16, 0, 0.09, -0.16, dark);
      break;
    case 'smg':
      box(0.06, 0.09, 0.4, 0, 0, -0.02);
      box(0.05, 0.09, 0.14, 0, -0.04, 0.18);
      box(0.05, 0.12, 0.06, 0, -0.1, -0.06, dark);
      barrel(0.35, 0, 0.03, -0.45, 0.018);
      sight();
      break;
    case 'marksman':
      box(0.06, 0.09, 0.46, 0, 0, -0.04);
      box(0.05, 0.08, 0.2, 0, -0.04, 0.22);
      box(0.05, 0.1, 0.08, 0, -0.09, -0.1, dark);
      barrel(0.55);
      box(0.03, 0.05, 0.14, 0, 0.12, -0.12, dark);
      break;
    case 'sniper':
      box(0.05, 0.08, 0.5, 0, 0, -0.03);
      box(0.045, 0.07, 0.22, 0, -0.03, 0.22);
      box(0.04, 0.09, 0.07, 0, -0.08, -0.08, dark);
      barrel(0.75, 0, 0.03, -0.65, 0.016);
      box(0.035, 0.045, 0.2, 0, 0.11, -0.14, dark);
      box(0.05, 0.03, 0.06, 0, 0.1, -0.32, dark);
      break;
    case 'shotgun':
      box(0.08, 0.12, 0.34, 0, 0, -0.02);
      box(0.07, 0.09, 0.3, 0, -0.03, -0.3);
      box(0.06, 0.11, 0.1, 0, -0.08, 0.12, dark);
      barrel(0.55, 0, 0.05, -0.5, 0.028);
      barrel(0.55, 0, 0.02, -0.5, 0.028);
      sight(0, 0.15);
      break;
    case 'sidearm':
      box(0.045, 0.08, 0.24, 0, 0, 0);
      box(0.04, 0.06, 0.1, 0, 0.01, -0.2);
      box(0.03, 0.06, 0.06, 0, -0.03, 0.05, dark);
      sight(0, 0.11, -0.06);
      break;
  }

  const flash = new THREE.Group();
  const flashMat = new THREE.MeshBasicMaterial({
    color: 0xffd27a,
    transparent: true,
    opacity: 0.9,
    side: THREE.DoubleSide,
  });
  const flashA = new THREE.Mesh(new THREE.PlaneGeometry(0.09, 0.09), flashMat);
  const flashB = new THREE.Mesh(new THREE.PlaneGeometry(0.09, 0.09), flashMat);
  flashA.rotation.y = Math.PI / 4;
  flashB.rotation.y = -Math.PI / 4;
  flash.add(flashA, flashB);
  flash.position.set(0, 0.03, cls === 'sniper' ? -0.75 : -0.62);
  flash.visible = false;
  group.add(flash);

  return { group, flash };
}
