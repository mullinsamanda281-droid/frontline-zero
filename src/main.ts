import * as THREE from 'three';
import './style.css';
import { FpsCounter } from './fpsCounter';
import { GameLoop } from './engine/gameLoop';
import { GameState, SceneManager } from './engine/sceneManager';
import { Keyboard } from './engine/input/keyboard';
import { MouseLook, PointerLock } from './engine/input/mouseLook';
import { FpsCamera } from './engine/camera/fpsCamera';
import { Vec3 } from './engine/camera/vec3';
import { CollisionWorld, makeAABB } from './engine/world/collision';
import { MatchManager } from './engine/match/matchManager';
import { SlideController } from './engine/movement/slide';
import { LeanController } from './engine/movement/lean';
import { DiveController } from './engine/movement/dive';
import { BunnyHopController } from './engine/movement/bunnyHop';
import { WeaponRuntime } from './engine/weapons/weapon';
import { WEAPONS } from './engine/weapons/weapons';
import { buildWeaponModel, type WeaponModel } from './engine/weapons/models';
import { type Damageable } from './engine/weapons/hitscan';
import { Bot } from './engine/bots/bot';
import { BotManager } from './engine/bots/botManager';
import { selectSpawnPoint } from './engine/match/matchManager';
import { NetClient } from './engine/net/netClient';

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
const warehouseMaterial = new THREE.MeshLambertMaterial({ color: 0x6b7b8c });
const craneMaterial = new THREE.MeshLambertMaterial({ color: 0x2e3540 });

type Box = { x: number; z: number; w: number; h: number; d: number; kind?: 'container' | 'containerDark' | 'warehouse' | 'crane' };
const placements: Box[] = [
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
for (const p of placements) {
  const material =
    p.kind === 'warehouse'
      ? warehouseMaterial
      : p.kind === 'crane'
        ? craneMaterial
        : p.kind === 'containerDark'
          ? containerMaterialDark
          : containerMaterial;
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(p.w, p.h, p.d), material);
  mesh.position.set(p.x, p.h / 2, p.z);
  scene.add(mesh);
}

const collisionWorld = new CollisionWorld(
  placements.map((p) => makeAABB(p.x, p.h / 2, p.z, p.w, p.h, p.d)),
);

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

const netParams = new URLSearchParams(window.location.search);
const netUrl = netParams.get('net');
const netMode = netUrl !== null;
const netName = netParams.get('name') ?? 'OP-1';
const netRoom = netParams.get('room') ?? 'default';

const player = new FpsCamera({
  jumpSpeed: 6.2,
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
      if (!netMode) match.kill('alpha', 'player', `target-${this.body.position.x.toFixed(0)}`);
      this.respawn();
    }
  }

  respawn(): void {
    let x = 0;
    let z = 0;
    for (let attempt = 0; attempt < 10; attempt++) {
      const angle = Math.random() * Math.PI * 2;
      const radius = 12 + Math.random() * 14;
      x = player.position.x + Math.cos(angle) * radius;
      z = player.position.z + Math.sin(angle) * radius;
      if (collisionWorld.heightAt(x, z) === 0 && collisionWorld.raycast(new Vec3(x, 1, z), new Vec3(0, 0, -1), 2) === null) break;
    }
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
  new TestTarget(-28, -34),
  new TestTarget(32, -22),
  new TestTarget(26, 18),
  new TestTarget(-30, 26),
];
const targetMeshes = targets.flatMap((t) => [t.body, t.head]);

const spawnPoints = [
  new Vec3(0, 0, 0),
  new Vec3(25, 0, 0),
  new Vec3(-25, 0, 0),
  new Vec3(0, 0, 25),
  new Vec3(0, 0, -25),
  new Vec3(25, 0, 25),
  new Vec3(-25, 0, 25),
  new Vec3(25, 0, -25),
  new Vec3(-25, 0, -25),
];

interface Hittable extends Damageable {
  body: THREE.Mesh;
  head: THREE.Mesh;
}

const botManager = netMode ? null : new BotManager({ minPlayers: 4, humanCount: 1 });
const botUnits: BotUnit[] = [];
class BotUnit implements Damageable {
  readonly body = new THREE.Mesh(
    new THREE.BoxGeometry(0.6, 1.2, 0.4),
    new THREE.MeshLambertMaterial({ color: 0x7a2e2e }),
  );
  readonly head = new THREE.Mesh(
    new THREE.BoxGeometry(0.32, 0.32, 0.32),
    new THREE.MeshLambertMaterial({ color: 0xc9a88f }),
  );
  readonly group = new THREE.Group();
  constructor(readonly bot: Bot) {
    this.body.position.y = 0.85;
    this.head.position.y = 1.6;
    const gun = new THREE.Mesh(
      new THREE.BoxGeometry(0.12, 0.12, 0.6),
      new THREE.MeshLambertMaterial({ color: 0x22262e }),
    );
    gun.position.set(0, 1.15, -0.4);
    this.group.add(this.body, this.head, gun);
    this.place();
    scene.add(this.group);
  }
  place(): void {
    const spawn = selectSpawnPoint(spawnPoints, player.position, Math.random);
    this.bot.position.set(spawn.x, 0, spawn.z);
    this.group.position.set(spawn.x, 0, spawn.z);
    this.group.visible = true;
  }
  takeDamage(amount: number): void {
    if (!this.bot.alive) return;
    this.bot.takeDamage(amount);
    this.body.material.color.set(0xff8a8a);
    this.head.material.color.set(0xffd2b0);
    setTimeout(() => {
      this.body.material.color.set(0x7a2e2e);
      this.head.material.color.set(0xc9a88f);
    }, 120);
    if (!this.bot.alive) {
      this.group.visible = false;
      if (!netMode) match.kill('alpha', 'player', this.bot.options.name);
      addKillFeed('YOU', this.bot.options.name, 'alpha');
    }
  }
}
botManager?.bots.forEach((b) => botUnits.push(new BotUnit(b)));
const hittableMeshes = [...targetMeshes, ...botUnits.flatMap((b) => [b.body, b.head])];
const hittables: Hittable[] = [...targets, ...botUnits];

const match = new MatchManager(
  { warmupSeconds: 3, matchSeconds: 300, scoreLimit: 30 },
  (phase, winner) => {
    if (phase === 'matchEnd') {
      matchEndEl.classList.remove('hidden');
      matchEndTitle.textContent = winner === 'alpha' ? 'VICTORY' : winner === 'bravo' ? 'DEFEAT' : 'DRAW';
      matchEndDetail.textContent = `${match.alphaScore} - ${match.bravoScore}`;
    }
  },
);
match.start();
match.joinPlayer('player');

let myNetId: string | null = null;
let netLatencyMs = 0;
const netPingEl = document.getElementById('net-ping') as HTMLElement;
if (netMode) netPingEl.classList.remove('hidden');
const netClient = netMode
  ? new NetClient(
      { url: netUrl as string, name: netName, room: netRoom },
      {
        onWelcome: (playerId, players) => {
          myNetId = playerId;
          for (const p of players) {
            if (p.id !== playerId) makeRemoteUnit(p.id, p.name);
          }
          addKillFeed('SYS', 'connected to room ' + netRoom, 'alpha');
        },
        onSnapshot: (_tick, players, events) => {
          for (const p of players) {
            if (p.id === myNetId) {
              if (!p.alive && !playerDead) {
                playerDead = true;
                deathTimer = 2;
                playerHealth = 0;
                updateHealth();
                respawnMsgEl.classList.remove('hidden');
              }
              // Server-authoritative state received
              continue;
            }
            makeRemoteUnit(p.id, p.name);
            const unit = remoteUnits.get(p.id);
            if (unit) {
              unit.group.position.x += (p.x - unit.group.position.x) * Math.min(1, 12 / 60);
              unit.group.position.y += (p.y - unit.group.position.y) * Math.min(1, 12 / 60);
              unit.group.position.z += (p.z - unit.group.position.z) * Math.min(1, 12 / 60);
              let diff = p.yaw - unit.group.rotation.y;
              while (diff > Math.PI) diff -= Math.PI * 2;
              while (diff < -Math.PI) diff += Math.PI * 2;
              unit.group.rotation.y += diff * Math.min(1, 10 / 60);
            }
          }
          for (const e of events) {
            if (e.kind === 'kill') {
              const killerName = players.find((pl) => pl.id === e.killer)?.name ?? e.killer;
              const victimName = players.find((pl) => pl.id === e.victim)?.name ?? e.victim;
              addKillFeed(killerName, victimName, 'alpha');
              if (e.victim === myNetId) hurtPlayer(100);
            }
          }
        },
        onJoinNotice: (player) => {
          makeRemoteUnit(player.id, player.name);
          addKillFeed('SYS', player.name + ' joined', 'alpha');
        },
        onLeaveNotice: (playerId) => removeRemoteUnit(playerId),
        onPong: () => undefined,
        onDisconnect: () => addKillFeed('SYS', 'connection lost', 'bravo'),
      },
    )
  : null;

const matchEndEl = document.getElementById('match-end') as HTMLElement;
const matchEndTitle = document.getElementById('match-end-title') as HTMLElement;
const matchEndDetail = document.getElementById('match-end-detail') as HTMLElement;
const scoreboardTimerEl = document.getElementById('scoreboard-timer') as HTMLElement;
const teamAlphaEl = document.getElementById('team-alpha') as HTMLElement;
const teamBravoEl = document.getElementById('team-bravo') as HTMLElement;
document.getElementById('restart')?.addEventListener('click', () => window.location.reload());

function formatTime(seconds: number): string {
  const total = Math.max(0, Math.ceil(seconds));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function raycastTargets(origin: Vec3, direction: Vec3, range: number) {
  const worldDist = collisionWorld.raycast(origin, direction, range);
  const raycaster = new THREE.Raycaster();
  raycaster.far = range;
  raycaster.set(
    new THREE.Vector3(origin.x, origin.y, origin.z),
    new THREE.Vector3(direction.x, direction.y, direction.z),
  );
  const hits = raycaster.intersectObjects(hittableMeshes, false);
  let targetHit: { target: Damageable | null; distance: number; isHeadshot: boolean } = {
    target: null,
    distance: range,
    isHeadshot: false,
  };
  if (hits.length > 0) {
    const hit = hits[0];
    const hittable = hittables.find((h) => h.body === hit.object || h.head === hit.object);
    targetHit = {
      target: hittable ?? null,
      distance: hit.distance,
      isHeadshot: hittable !== undefined && hit.object === hittable.head,
    };
  }
  if (worldDist !== null && (targetHit.target === null || worldDist < targetHit.distance)) {
    return { target: null, distance: worldDist };
  }
  return targetHit;
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

const remoteUnits = new Map<string, { group: THREE.Group; name: string }>();

function makeRemoteUnit(id: string, name: string): void {
  if (remoteUnits.has(id)) return;
  const group = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(0.6, 1.2, 0.4),
    new THREE.MeshLambertMaterial({ color: 0x8a3a3a }),
  );
  body.position.y = 0.85;
  const head = new THREE.Mesh(
    new THREE.BoxGeometry(0.32, 0.32, 0.32),
    new THREE.MeshLambertMaterial({ color: 0xc9a88f }),
  );
  head.position.y = 1.6;
  group.add(body, head);
  scene.add(group);
  remoteUnits.set(id, { group, name });
}

function removeRemoteUnit(id: string): void {
  const unit = remoteUnits.get(id);
  if (unit) {
    scene.remove(unit.group);
    remoteUnits.delete(id);
  }
}

const fpsCounter = new FpsCounter(document.getElementById('fps-counter') as HTMLElement);

let playerHealth = 100;
let playerDead = false;
let deathTimer = 0;
const healthTextEl = document.getElementById('health-text') as HTMLElement;
const dmgFlashEl = document.getElementById('dmg-flash') as HTMLElement;
const respawnMsgEl = document.getElementById('respawn-msg') as HTMLElement;
const killFeedEl = document.getElementById('kill-feed') as HTMLElement;

function updateHealth(): void {
  healthFill.style.width = `${playerHealth}%`;
  healthTextEl.textContent = `${Math.ceil(playerHealth)}`;
}

let botShotsLanded = 0;

function hurtPlayer(amount: number): void {
  if (playerDead) return;
  botShotsLanded++;
  playerHealth -= amount;
  updateHealth();
  dmgFlashEl.classList.remove('show');
  void dmgFlashEl.offsetWidth;
  dmgFlashEl.classList.add('show');
  if (playerHealth <= 0) {
    playerDead = true;
    deathTimer = 2;
    playerHealth = 0;
    updateHealth();
    if (!netMode) match.kill('bravo', 'ENEMY', 'player');
    addKillFeed('ENEMY', 'YOU', 'bravo');
    respawnMsgEl.classList.remove('hidden');
  }
}

function addKillFeed(killer: string, victim: string, team: 'alpha' | 'bravo'): void {
  const entry = document.createElement('div');
  entry.className = `kill-entry ${team === 'alpha' ? 'k-alpha' : 'k-bravo'}`;
  entry.textContent = `${killer}  ▸  ${victim}`;
  killFeedEl.appendChild(entry);
  setTimeout(() => entry.remove(), 4000);
}
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
    const collision = collisionWorld.resolveCapsule(player.position, 0.35, 1.8);
    player.floorY = collision.floorY;
    match.update(1 / 60);
    scoreboardTimerEl.textContent = formatTime(match.timeRemaining);
    teamAlphaEl.textContent = `ALPHA ${match.alphaScore}`;
    teamBravoEl.textContent = `${match.bravoScore} BRAVO`;
    slide.update(1 / 60, player, crouchHeld);

    if (playerDead) {
      deathTimer -= 1 / 60;
      if (deathTimer <= 0) {
        const botsCentroid = botUnits.reduce(
          (acc, b) => ({ x: acc.x + b.bot.position.x, z: acc.z + b.bot.position.z }),
          { x: 0, z: 0 },
        );
        botsCentroid.x /= botUnits.length;
        botsCentroid.z /= botUnits.length;
        const spawn = selectSpawnPoint(spawnPoints, botsCentroid, Math.random);
        player.position.set(spawn.x, 0, spawn.z);
        player.velocity.set(0, 0, 0);
        playerDead = false;
        playerHealth = 100;
        updateHealth();
        respawnMsgEl.classList.remove('hidden');
        void respawnMsgEl.offsetWidth;
        respawnMsgEl.classList.add('hidden');
      }
    } else if (!netMode) {
      const playerEye = new Vec3(
        player.position.x + player.right.x * lean.offset,
        player.position.y + player.eyeHeight + lean.heightOffset,
        player.position.z + player.right.z * lean.offset,
      );
      for (const unit of botUnits) {
        const b = unit.bot;
        if (!b.alive && b.respawnTimer <= 0 && Number.isFinite(b.respawnTimer)) {
          b.alive = true;
          b.health = 100;
          b.state = 'patrol';
          unit.place();
        }
        const botEye = new Vec3(b.position.x, b.position.y + 1.5, b.position.z);
        const toPlayer = new Vec3(
          playerEye.x - botEye.x,
          playerEye.y - botEye.y,
          playerEye.z - botEye.z,
        );
        const dist = toPlayer.length;
        const los = collisionWorld.raycast(botEye, toPlayer.scale(1 / Math.max(dist, 1e-6)), dist) === null;
        b.update(1 / 60, {
          playerPosition: new Vec3(playerEye.x, 0, playerEye.z),
          lineOfSight: los,
          shootPlayer: (damage) => {
            if (match.phase === 'playing') hurtPlayer(damage);
          },
        });
        unit.group.rotation.y = b.yaw;
      }
    }
    bunnyHop.update(16.67, player, keyboard.isDown('Space'));
    lean.update(1 / 60, player, keyboard.isDown('KeyQ'), keyboard.isDown('KeyE'));
    dive.update(1 / 60, player, diveHeld, keyboard.isDown('KeyZ'));

    if (netClient) {
      netClient.sendInput({
        forward: keyboard.isDown('KeyW'),
        back: keyboard.isDown('KeyS'),
        left: keyboard.isDown('KeyA'),
        right: keyboard.isDown('KeyD'),
        jump: keyboard.isDown('Space'),
        sprint: keyboard.isDown('ShiftLeft'),
        yaw: player.yaw,
        pitch: player.pitch,
      });
      if (!netClient._lastPing || performance.now() - netClient._lastPing > 1000) {
        netClient.ping();
        netClient._lastPing = performance.now();
      }
      netLatencyMs = netClient.latencyMs;
      netPingEl.textContent = netLatencyMs > 0 ? `${Math.round(netLatencyMs)} ms` : 'PING …';
    }

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
updateHealth();
weapon.draw();
sceneManager.goTo(GameState.Match);

interface SmokeHandle {
  botCount: number;
  botShots: () => number;
  phase: () => string;
}
declare global {
  interface Window {
    __smoke?: SmokeHandle;
  }
}
interface NetSmokeHandle {
  remoteCount: () => number;
  remotePos: () => { x: number; z: number } | null;
}
interface SmokeHandle {
  botCount: number;
  botShots: () => number;
  phase: () => string;
  net?: NetSmokeHandle;
}
declare global {
  interface Window {
    __smoke?: SmokeHandle;
    __net?: NetSmokeHandle;
  }
}
window.__smoke = {
  botCount: botUnits.length,
  botShots: () => botShotsLanded,
  phase: () => match.phase,
};
window.__net = {
  remoteCount: () => remoteUnits.size,
  remotePos: () => {
    const unit = [...remoteUnits.values()][0];
    return unit ? { x: unit.group.position.x, z: unit.group.position.z } : null;
  },
};
