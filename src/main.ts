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

const MOUSE_SENSITIVITY = 0.002;

const canvas = document.getElementById('game') as HTMLCanvasElement;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0e1526);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 1.6, 3);

const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(20, 20),
  new THREE.MeshLambertMaterial({ color: 0x2a3350 }),
);
ground.rotation.x = -Math.PI / 2;
scene.add(ground);

const testProp = new THREE.Mesh(
  new THREE.BoxGeometry(1, 1, 1),
  new THREE.MeshLambertMaterial({ color: 0x4f8f6f }),
);
testProp.position.y = 0.5;
scene.add(testProp);

scene.add(new THREE.HemisphereLight(0xffffff, 0x334455, 1));

const sceneManager = new SceneManager();
sceneManager.goTo(GameState.Loading);

const keyboard = new Keyboard();
keyboard.attach();

const pointerLock = new PointerLock(canvas);
pointerLock.attach();
canvas.addEventListener('click', () => pointerLock.request());

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
const weapon = new WeaponRuntime(WEAPONS.ar);

class TestTarget {
  readonly mesh = new THREE.Mesh(
    new THREE.BoxGeometry(1, 2, 0.5),
    new THREE.MeshLambertMaterial({ color: 0xcc5544 }),
  );
  hp = 100;
  constructor(x: number, z: number) {
    this.mesh.position.set(x, 1, z);
    scene.add(this.mesh);
  }

  takeDamage(amount: number): void {
    this.hp -= amount;
    this.mesh.rotation.x = Math.max(0, this.mesh.rotation.x + 0.01);
    if (this.hp <= 0) {
      this.hp = 100;
      this.mesh.position.x = (Math.random() * 2 - 1) * 5;
      this.mesh.position.z = -8 - Math.random() * 4;
      this.mesh.rotation.x = 0;
    }
  }
}

const targets: TestTarget[] = [new TestTarget(0, -8), new TestTarget(3, -6), new TestTarget(-3, -7)];
const targetMeshes = targets.map((t) => t.mesh);

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
  return { target: targets.find((t) => t.mesh === hit.object) ?? null, distance: hit.distance };
}

const fpsCounter = new FpsCounter(document.getElementById('fps-counter') as HTMLElement);

let triggerHeld = false;
window.addEventListener('mousedown', (event) => {
  if (event.button === 0 && pointerLock.isLocked) triggerHeld = true;
});
window.addEventListener('mouseup', (event) => {
  if (event.button === 0) triggerHeld = false;
});
window.addEventListener('keydown', (event) => {
  if (event.code === 'KeyR') weapon.reload();
});

function resize(): void {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

window.addEventListener('resize', resize);
resize();

const gameLoop = new GameLoop({
  update: () => {
    testProp.rotation.y += 0.01;
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
    weapon.update(1 / 60, { moving: horizontalSpeed > 0.1, triggerHeld });
    if (triggerHeld && weapon.canFire) {
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
      weapon.fire(eye, dir, raycastTargets, Math.random);
      player.look(-weapon.recoil.yawOffset, -weapon.recoil.pitchOffset, 1);
    }
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

sceneManager.goTo(GameState.Match);
