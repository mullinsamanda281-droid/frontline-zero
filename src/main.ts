import * as THREE from 'three';
import './style.css';
import { FpsCounter } from './fpsCounter';
import { GameLoop } from './engine/gameLoop';
import { GameState, SceneManager } from './engine/sceneManager';
import { Keyboard } from './engine/input/keyboard';
import { MouseLook, PointerLock } from './engine/input/mouseLook';
import { FpsCamera } from './engine/camera/fpsCamera';
import { SlideController } from './engine/movement/slide';
import { LeanController } from './engine/movement/lean';
import { DiveController } from './engine/movement/dive';
import { BunnyHopController } from './engine/movement/bunnyHop';

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

const fpsCounter = new FpsCounter(document.getElementById('fps-counter') as HTMLElement);

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
