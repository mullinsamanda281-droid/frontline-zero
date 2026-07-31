import * as THREE from 'three';
import './style.css';
import { FpsCounter } from './fpsCounter';
import { GameLoop } from './engine/gameLoop';
import { GameState, SceneManager } from './engine/sceneManager';
import { Keyboard } from './engine/input/keyboard';
import { MouseLook, PointerLock } from './engine/input/mouseLook';
import { FpsCamera } from './engine/camera/fpsCamera';
import { Vec3 } from './engine/camera/vec3';
import { SlideController } from './engine/movement/slide';
import { LeanController } from './engine/movement/lean';
import { DiveController } from './engine/movement/dive';
import { BunnyHopController } from './engine/movement/bunnyHop';
import { WeaponRuntime } from './engine/weapons/weapon';
import { WEAPONS } from './engine/weapons/weapons';
import { buildWeaponModel, type WeaponModel } from './engine/weapons/models';
import { type Damageable } from './engine/weapons/hitscan';

const MOUSE_SENSITIVITY = 0.002;

const canvas = document.getElementById('game') as HTMLCanvasElement;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x8fb4d9);
scene.fog = new THREE.Fog(0x8fb4d9, 60, 160);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 300);
camera.position.set(0, 1.6, 3);

const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(120, 120),
  new THREE.MeshLambertMaterial({ color: 0x7a7f7c }),
);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

const containerMaterial = new THREE.MeshLambertMaterial({ color: 0xb46a3f });
const containerMaterialDark = new THREE.MeshLambertMaterial({ color: 0x8a4a28 });
const placements: { x: number; z: number; w: number; h: number; d: number }[] = [
  { x: -6, z: -10, w: 3, h: 2.5, d: 6 },
  { x: 6, z: -8, w: 3, h: 2.5, d: 6 },
  { x: 10, z: -18, w: 3, h: 2.5, d: 6 },
  { x: -12, z: -16, w: 3, h: 2.5, d: 6 },
  { x: 0, z: -24, w: 6, h: 5, d: 3 },
  { x: -20, z: -6, w: 6, h: 1.2, d: 3 },
  { x: 16, z: 4, w: 6, h: 1.2, d: 3 },
  { x: -4, z: 8, w: 3, h: 2.5, d: 6 },
  { x: 22, z: -12, w: 6, h: 5, d: 3 },
];
for (const p of placements) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(p.w, p.h, p.d),
    p.h > 3 ? containerMaterialDark : containerMaterial,
  );
  mesh.position.set(p.x, p.h / 2, p.z);
  scene.add(mesh);
}

scene.add(new THREE.HemisphereLight(0xffffff, 0x44606e, 1));
const sun = new THREE.DirectionalLight(0xffffff, 1.2);
sun.position.set(30, 50, 20);
scene.add(sun);

const sceneManager = new SceneManager();
sceneManager.goTo(GameState.Loading);

const keyboard = new Keyboard();
keyboard.attach();

const pointerLock = new PointerLock(canvas);
pointerLock.attach();

const overlay = document.getElementById('overlay') as HTMLElement;
const startButton = document.getElementById('start') as HTMLButtonElement;
startButton.addEventListener('click', () => {
  overlay.classList.add('hidden');
  pointerLock.request();
});
document.addEventListener('pointerlockchange', () => {
  if (!pointerLock.isLocked && !overlay.classList.contains('hidden')) overlay.classList.remove('hidden');
});

const mouse = new MouseLook();
mouse.attach();

const player = new FpsCamera({
  staminaChangeListener: (ratio) => {
    const fill = document.getElementById('stamina-fill') as HTMLElement;
    fill.style.width = `${Math.round(ratio * 100)}%`;
  },
});
player.position.y = 0;

const slide = new SlideController({});
const lean = new LeanController({});
const dive = new DiveController({});
const bunnyHop = new BunnyHopController({});

const weaponOrder = ['ar', 'smg', 'marksman', 'sniper', 'shotgun', 'sidearm'] as const;
const weaponSlots = weaponOrder.map((id) => new WeaponRuntime(WEAPONS[id]));
let activeSlot = 0;
let weapon = weaponSlots[0];

const weaponNameEl = document.getElementById('weapon-name') as HTMLElement;
const ammoEl = document.getElementById('ammo-count') as HTMLElement;
const scoreEl = document.getElementById('score') as HTMLElement;
const hitmarkerEl = document.getElementById('hitmarker') as HTMLElement;
const healthFill = document.getElementById('health-fill') as HTMLElement;
let targetsDown = 0;

class TestTarget implements Damageable {
  readonly body = new THREE.Mesh(
    new THREE.BoxGeometry(0.9, 1.6, 0.45),
    new THREE.MeshLambertMaterial({ color: 0xcc5544 }),
  );
  readonly head = new THREE.Mesh(
    new THREE.BoxGeometry(0.42, 0.42, 0.42),
    new THREE.MeshLambertMaterial({ color: 0xe8b45a }),
  );
  hp = 100;
  constructor(x: number, z: number) {
    this.body.position.set(x, 0.8, z);
    this.head.position.set(x, 1.95, z);
    scene.add(this.body);
    scene.add(this.head);
  }

  takeDamage(amount: number): void {
    this.hp -= amount;
    if (this.hp <= 0) {
      this.hp = 100;
      targetsDown++;
      scoreEl.textContent = `TARGETS DOWN: ${targetsDown}`;
      this.respawn();
    }
  }

  respawn(): void {
    const angle = Math.random() * Math.PI * 2;
    const radius = 12 + Math.random() * 14;
    const x = player.position.x + Math.cos(angle) * radius;
    const z = player.position.z + Math.sin(angle) * radius;
    this.body.position.set(x, 0.8, z);
    this.head.position.set(x, 1.95, z);
  }
}

const targets: TestTarget[] = [
  new TestTarget(0, -12),
  new TestTarget(6, -20),
  new TestTarget(-8, -18),
  new TestTarget(14, -10),
  new TestTarget(-14, -4),
  new TestTarget(4, -30),
  new TestTarget(-10, -26),
  new TestTarget(20, 0),
];
const targetMeshes = targets.flatMap((t) => [t.body, t.head]);

function raycastTargets(origin: Vec3, direction: Vec3, range: number) {
  const raycaster = new THREE.Raycaster();
  raycaster.far = range;
  raycaster.set(
    new THREE.Vector3(origin.x, origin.y, origin.z),
    new THREE.Vector3(direction.x, direction.y, direction.z),
  );
  const hits = raycaster.intersectObjects(targetMeshes, false);
  if (hits.length === 0) return { target: null, distance: range };
  const hit = hits[0];
  return {
    target: targets.find((t) => t.body === hit.object || t.head === hit.object) ?? null,
    distance: hit.distance,
    isHeadshot: hit.object === targets.find((t) => t.head === hit.object)?.head,
  };
}

const weaponPivot = new THREE.Group();
weaponPivot.position.set(0.3, -0.24, -0.55);
const weaponModels = weaponOrder.map((id) => buildWeaponModel(WEAPONS[id].class));
weaponModels.forEach((model) => weaponPivot.add(model.group));
modelFor(activeSlot).group.visible = true;
camera.add(weaponPivot);
scene.add(camera);

function modelFor(slot: number): WeaponModel {
  return weaponModels[slot];
}

function switchWeapon(slot: number): void {
  if (slot === activeSlot) return;
  modelFor(activeSlot).group.visible = false;
  activeSlot = slot;
  weapon = weaponSlots[slot];
  weapon.draw();
  modelFor(activeSlot).group.visible = true;
  weaponNameEl.textContent = weapon.data.name;
}

const fpsCounter = new FpsCounter(document.getElementById('fps-counter') as HTMLElement);
const crosshairEl = document.getElementById('crosshair') as HTMLElement;

let triggerHeld = false;
let triggerPressed = false;
let adsHeld = false;
window.addEventListener('mousedown', (event) => {
  if (!pointerLock.isLocked) return;
  if (event.button === 0) {
    triggerHeld = true;
    triggerPressed = true;
  }
  if (event.button === 2) adsHeld = true;
});
window.addEventListener('mouseup', (event) => {
  if (event.button === 0) triggerHeld = false;
  if (event.button === 2) adsHeld = false;
});
window.addEventListener('contextmenu', (event) => event.preventDefault());
window.addEventListener('wheel', (event) => {
  if (!pointerLock.isLocked) return;
  const delta = event.deltaY > 0 ? 1 : -1;
  switchWeapon((activeSlot + delta + weaponOrder.length) % weaponOrder.length);
});
window.addEventListener('keydown', (event) => {
  if (event.code === 'KeyR') weapon.reload();
  const slotMap: Record<string, number> = {
    Digit1: 0,
    Digit2: 1,
    Digit3: 2,
    Digit4: 3,
    Digit5: 4,
    Digit6: 5,
  };
  const slot = slotMap[event.code];
  if (slot !== undefined) switchWeapon(slot);
});

function resize(): void {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

window.addEventListener('resize', resize);
resize();

const BASE_FOV = 75;
let currentFov = BASE_FOV;
let targetFov = BASE_FOV;
const scopeOverlay = document.getElementById('scope-overlay') as HTMLElement;

function applyAds(): void {
  const adsZoom = weapon.data.scopeZoom ?? 1.3;
  targetFov = adsHeld && !weapon.drawing ? BASE_FOV / adsZoom : BASE_FOV;
  currentFov += (targetFov - currentFov) * Math.min(1, 10 / 60);
  camera.fov = currentFov;
  camera.updateProjectionMatrix();
  const scoped = adsHeld && (weapon.data.scopeZoom ?? 0) > 1;
  scopeOverlay.style.display = scoped ? 'block' : 'none';
  crosshairEl.classList.toggle('ads-hidden', scoped);
  player.speedMultiplier = adsHeld ? (weapon.data.moveSpeedMultiplier ?? 1) : 1;
  weaponPivot.position.lerp(
    new THREE.Vector3(adsHeld ? 0 : 0.3, adsHeld ? -0.16 : -0.24, adsHeld ? -0.5 : -0.55),
    Math.min(1, 12 / 60),
  );
}

const gameLoop = new GameLoop({
  update: () => {
    const { dx, dy } = mouse.consume();
    if (dx !== 0 || dy !== 0) player.look(dx, dy, MOUSE_SENSITIVITY);
    const crouchHeld = keyboard.isDown('KeyC');
    const diveHeld = keyboard.isDown('KeyZ') && slide.phase !== 'sliding';
    player.update(1 / 60, {
      forward: keyboard.isDown('KeyW'),
      back: keyboard.isDown('KeyS'),
      left: keyboard.isDown('KeyA'),
      right: keyboard.isDown('KeyD'),
      jump: keyboard.isDown('Space'),
      sprint: keyboard.isDown('ShiftLeft'),
    });
    slide.update(1 / 60, player, crouchHeld);
    bunnyHop.update(16.67, player, keyboard.isDown('Space'));
    lean.update(1 / 60, player, keyboard.isDown('KeyQ'), keyboard.isDown('KeyE'));
    dive.update(1 / 60, player, diveHeld, keyboard.isDown('KeyZ'));

    const horizontalSpeed = Math.hypot(player.velocity.x, player.velocity.z);
    const ads = adsHeld && !weapon.drawing;
    player.speedMultiplier = ads ? (weapon.data.moveSpeedMultiplier ?? 1) : 1;
    weapon.update(1 / 60, { moving: horizontalSpeed > 0.1, triggerHeld });
    applyAds();

    const wantsFire = weapon.data.semiAuto ? triggerPressed : triggerHeld;
    triggerPressed = false;
    if (wantsFire && weapon.canFire) {
      const yaw = player.yaw;
      const pitch = player.pitch;
      const eye = new Vec3(
        player.position.x + player.right.x * lean.offset,
        player.position.y + player.eyeHeight + lean.heightOffset,
        player.position.z + player.right.z * lean.offset,
      );
      const dir = new Vec3(
        -Math.sin(yaw) * Math.cos(pitch),
        Math.sin(pitch),
        -Math.cos(yaw) * Math.cos(pitch),
      );
      const outcome = weapon.fire(eye, dir, raycastTargets, Math.random);
      if (outcome.hitCount > 0) {
        hitmarkerEl.classList.remove('show');
        void hitmarkerEl.offsetWidth;
        hitmarkerEl.classList.add('show');
      }
      const model = modelFor(activeSlot);
      model.flash.visible = true;
      setTimeout(() => {
        model.flash.visible = false;
      }, 40);
      player.look(-weapon.recoil.yawOffset, -weapon.recoil.pitchOffset, 1);
    }

    ammoEl.textContent = `${weapon.ammo} / ${weapon.reserve}`;
  },
  render: () => {
    const right = player.right;
    camera.position.set(
      player.position.x + right.x * lean.offset,
      player.position.y + player.eyeHeight + lean.heightOffset,
      player.position.z + right.z * lean.offset,
    );
    camera.rotation.order = 'YXZ';
    camera.rotation.y = player.yaw;
    camera.rotation.x = player.pitch;
    renderer.render(scene, camera);
    fpsCounter.tick();
  },
});
gameLoop.start();

renderer.setAnimationLoop((time) => {
  gameLoop.tick(time);
});

weaponNameEl.textContent = weapon.data.name;
healthFill.style.width = '100%';
weapon.draw();
sceneManager.goTo(GameState.Match);
