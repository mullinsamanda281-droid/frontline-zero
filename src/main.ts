import * as THREE from 'three';
import './style.css';
import { FpsCounter } from './fpsCounter';

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

const fpsCounter = new FpsCounter(document.getElementById('fps-counter') as HTMLElement);

function resize(): void {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

window.addEventListener('resize', resize);
resize();

renderer.setAnimationLoop(() => {
  testProp.rotation.y += 0.01;
  renderer.render(scene, camera);
  fpsCounter.tick();
});
