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
import { PLACEMENTS, type BoxKind } from './engine/world/portMap';
import { buildProp, type DecorKind } from './engine/world/props';
import { createGround, createSky, createSun, createSunDisc, createWater, HORIZON_COLOR } from './engine/world/environment';
import { buildSoldier, animateSoldier, type SoldierModel } from './engine/world/character';
import { ParticleSystem } from './engine/effects/particles';
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
import { sfx } from './audio/audioManager';
import { ObjectPool } from './engine/perf/objectPool';

const MOUSE_SENSITIVITY = 0.002;

const canvas = document.getElementById('game') as HTMLCanvasElement;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(HORIZON_COLOR, 50, 170);
scene.background = new THREE.Color(0xff0000);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 300);
camera.position.set(0, 1.6, 3);

const ground = createGround(150).mesh;
scene.add(ground);

const water = createWater(400);
scene.add(water.mesh);
const sky = createSky();
scene.add(sky);

const sunDisc = createSunDisc();
sunDisc.position.copy(new THREE.Vector3(42, 60, 28).normalize().multiplyScalar(165));
scene.add(sunDisc);

const particles = new ParticleSystem(scene);

type Placement = { x: number; z: number; w: number; h: number; d: number; kind?: BoxKind | DecorKind };
const placements: Placement[] = PLACEMENTS;
const propMeshes: THREE.Object3D[] = [];
for (const p of placements) {
  const kind = p.kind ?? (p.h >= 1.5 ? 'crate' : 'pallet');
  const built = buildProp(kind, p.w, p.h, p.d);
  built.group.position.set(p.x, 0, p.z);
  built.group.traverse((obj) => {
    if (obj instanceof THREE.Mesh) obj.castShadow = true;
  });
  scene.add(built.group);
  propMeshes.push(built.group);
}

const DECOR: Array<{ x: number; z: number; kind: DecorKind }> = [
  { x: 8, z: -56, kind: 'barrel' },
  { x: 8.9, z: -56.8, kind: 'barrel' },
  { x: -8, z: -56, kind: 'barrel' },
  { x: 40, z: -40, kind: 'barrel' },
  { x: 40.9, z: -40.8, kind: 'barrel' },
  { x: -40, z: 40, kind: 'barrel' },
  { x: -40.9, z: 40.8, kind: 'barrel' },
  { x: 4, z: 40, kind: 'barrel' },
  { x: 0, z: 38.6, kind: 'crate' },
  { x: 46, z: -46.5, kind: 'crate' },
  { x: -46, z: 46, kind: 'crate' },
  { x: -3.4, z: -57.5, kind: 'pallet' },
  { x: 37, z: -67, kind: 'pallet' },
  { x: -12.5, z: -68, kind: 'pallet' },
  { x: -28, z: -24, kind: 'sandbag' },
  { x: 24, z: -26, kind: 'sandbag' },
  { x: -28, z: 26, kind: 'sandbag' },
  { x: 26, z: 28, kind: 'sandbag' },
  { x: 0, z: -74, kind: 'buoy' },
  { x: 50, z: -52, kind: 'buoy' },
  { x: -52, z: 50, kind: 'buoy' },
];
for (const dec of DECOR) {
  const built = buildProp(dec.kind, 1, 1, 1);
  built.group.position.set(dec.x, 0, dec.z);
  built.group.rotation.y = Math.random() * Math.PI * 2;
  scene.add(built.group);
  propMeshes.push(built.group);
}

const collisionWorld = new CollisionWorld(
  placements.map((p) => makeAABB(p.x, p.h / 2, p.z, p.w, p.h, p.d)),
);

scene.add(new THREE.HemisphereLight(0xbfd8f0, 0x4a4e40, 0.85));
const sun = createSun();
scene.add(sun);
sun.target.position.set(0, 0, 0);
scene.add(sun.target);

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

const hitmarkerPool = new ObjectPool(
  () => {
    const el = document.createElement('div');
    el.className = 'hitmarker';
    document.body.appendChild(el);
    return el;
  },
  (el) => { el.classList.remove('show'); el.style.display = 'none'; },
  5,
);
hitmarkerPool.acquire();
const activeHitmarkers = new Set<HTMLDivElement>();

function spawnHitmarker(): void {
  const hm = hitmarkerPool.acquire();
  hm.style.display = '';
  void hm.offsetWidth;
  hm.classList.add('show');
  activeHitmarkers.add(hm);
  setTimeout(() => {
    hm.classList.remove('show');
    activeHitmarkers.delete(hm);
    hitmarkerPool.release(hm);
  }, 350);
}

const tracerPool = new ObjectPool(
  () => {
    const geo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, 0, -1),
    ]);
    const mat = new THREE.LineBasicMaterial({ color: 0xffff00, transparent: true, opacity: 0.6 });
    const line = new THREE.Line(geo, mat);
    scene.add(line);
    line.visible = false;
    return line;
  },
  (line) => { line.visible = false; line.geometry.setDrawRange(0, 0); },
  10,
);
const activeTracers = new Set<THREE.Line>();

const weaponNameEl = document.getElementById('weapon-name') as HTMLElement;
const ammoEl = document.getElementById('ammo-count') as HTMLElement;
const scoreEl = document.getElementById('score') as HTMLElement;
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
  readonly body: THREE.Mesh;
  readonly head: THREE.Mesh;
  readonly group: THREE.Group;
  private readonly model: SoldierModel;
  private walkPhase = 0;
  private lastX = 0;
  private lastZ = 0;
  private readonly bodyColor: number;
  private readonly headColor: number;
  constructor(readonly bot: Bot) {
    this.model = buildSoldier(bot.options.team);
    this.body = this.model.body;
    this.head = this.model.head;
    this.group = this.model.group;
    this.bodyColor = (this.body.material as THREE.MeshLambertMaterial).color.getHex();
    this.headColor = (this.head.material as THREE.MeshLambertMaterial).color.getHex();
    this.place();
    scene.add(this.group);
  }
  place(): void {
    const spawn = selectSpawnPoint(spawnPoints, player.position, Math.random);
    this.bot.position.set(spawn.x, 0, spawn.z);
    this.group.position.set(spawn.x, 0, spawn.z);
    this.group.visible = true;
    this.lastX = spawn.x;
    this.lastZ = spawn.z;
  }
  takeDamage(amount: number): void {
    if (!this.bot.alive) return;
    this.bot.takeDamage(amount);
    const flash = (m: THREE.MeshLambertMaterial, original: number): void => {
      m.color.set(0xff8a8a);
      setTimeout(() => m.color.set(original), 120);
    };
    flash(this.body.material as THREE.MeshLambertMaterial, this.bodyColor);
    flash(this.head.material as THREE.MeshLambertMaterial, this.headColor);
    if (!this.bot.alive) {
      this.group.visible = false;
      if (!netMode) match.kill('alpha', 'player', this.bot.options.name);
      addKillFeed('YOU', this.bot.options.name, 'alpha');
    }
  }
  animate(): void {
    const dx = this.bot.position.x - this.lastX;
    const dz = this.bot.position.z - this.lastZ;
    this.lastX = this.bot.position.x;
    this.lastZ = this.bot.position.z;
    const speed = Math.hypot(dx, dz);
    const moving = speed > 0.001;
    if (moving) this.walkPhase += speed * 9;
    animateSoldier(this.model, this.walkPhase, moving, this.bot.state === 'engage');
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

const remoteUnits = new Map<string, { group: THREE.Group; name: string; model: SoldierModel; phase: number; lastX: number; lastZ: number }>();

function makeRemoteUnit(id: string, name: string): void {
  if (remoteUnits.has(id)) return;
  const model = buildSoldier('bravo');
  scene.add(model.group);
  remoteUnits.set(id, { group: model.group, name, model, phase: 0, lastX: 0, lastZ: 0 });
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
let regenTimer = 3;
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
  regenTimer = 3;
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
let jumpPressed = false;
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
  if (event.code === 'KeyR') { weapon.reload(); sfx.reload(); }
  const slotMap: Record<string, number> = {
    Digit1: 0,
    Digit2: 1,
    Digit3: 2,
    Digit4: 3,
    Digit5: 4,
    Digit6: 5,
  };
  const slot = slotMap[event.code];
  if (slot !== undefined) { switchWeapon(slot); sfx.switch(); }
  if (event.code === 'KeyQ' && !event.repeat) cycleQuality();
});

function resize(): void {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

window.addEventListener('resize', resize);
resize();

const BASE_FOV = 75;

type QualityLevel = 'low' | 'medium' | 'high';
let qualityLevel: QualityLevel = 'medium';
let shadowEnabled = true;
let shadowMapSize = 1024;

function applyQuality(): void {
  const dpr = Math.min(window.devicePixelRatio, qualityLevel === 'low' ? 1 : qualityLevel === 'medium' ? 1.5 : 2);
  renderer.setPixelRatio(dpr);
  shadowEnabled = qualityLevel !== 'low';
  shadowMapSize = qualityLevel === 'low' ? 512 : qualityLevel === 'medium' ? 1024 : 2048;
  if (sun) {
    sun.castShadow = shadowEnabled;
    sun.shadow.mapSize.width = shadowMapSize;
    sun.shadow.mapSize.height = shadowMapSize;
  }
  const qEl = document.getElementById('quality-level') as HTMLElement;
  if (qEl) qEl.textContent = qualityLevel.toUpperCase();
}

function cycleQuality(): void {
  const levels: QualityLevel[] = ['low', 'medium', 'high'];
  const idx = levels.indexOf(qualityLevel);
  qualityLevel = levels[(idx + 1) % levels.length];
  applyQuality();
}
let currentFov = BASE_FOV;
let targetFov = BASE_FOV;
const scopeOverlay = document.getElementById('scope-overlay') as HTMLElement;

function applyAds(): void {
  const adsZoom = weapon.data.scopeZoom ?? 1.3;
  const ads = adsHeld && !weapon.drawing && !playerDead;
  targetFov = ads ? BASE_FOV / adsZoom : BASE_FOV;
  currentFov += (targetFov - currentFov) * Math.min(1, 10 / 60);
  camera.fov = currentFov;
  camera.updateProjectionMatrix();
  const scoped = ads && (weapon.data.scopeZoom ?? 0) > 1;
  scopeOverlay.style.display = scoped ? 'block' : 'none';
  crosshairEl.classList.toggle('ads-hidden', scoped);
  player.speedMultiplier = ads ? (weapon.data.moveSpeedMultiplier ?? 1) : 1;
  weaponPivot.position.lerp(
    new THREE.Vector3(ads ? 0 : 0.3, ads ? -0.16 : -0.24, ads ? -0.5 : -0.55),
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
    water.tick(1 / 60);
    match.update(1 / 60);
    scoreboardTimerEl.textContent = formatTime(match.timeRemaining);
    teamAlphaEl.textContent = `ALPHA ${match.alphaScore}`;
    teamBravoEl.textContent = `${match.bravoScore} BRAVO`;
    slide.update(1 / 60, player, crouchHeld);

    if (keyboard.isDown('Space') && !jumpPressed) { sfx.jump(); jumpPressed = true; }
    if (!keyboard.isDown('Space')) jumpPressed = false;
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
        unit.animate();
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
    weapon.update(1 / 60, { moving: horizontalSpeed > 0.1, triggerHeld });
    applyAds();

    if (!playerDead) {
      regenTimer -= 1 / 60;
      if (regenTimer <= 0 && playerHealth < 100 && !netMode) {
        playerHealth = Math.min(100, playerHealth + 10 * (1 / 60));
        updateHealth();
      }
    }

    const wantsFire = weapon.data.semiAuto ? triggerPressed : triggerHeld;
    triggerPressed = false;
    if (wantsFire && weapon.canFire && !playerDead) {
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
        spawnHitmarker();
        sfx.hit();
        sfx.kill();
        particles.spawnSpark(outcome.lastHitX, outcome.lastHitY, outcome.lastHitZ);
      }
      const model = modelFor(activeSlot);
      model.flash.visible = true;
      setTimeout(() => {
        model.flash.visible = false;
      }, 40);
      sfx.shoot();
      const muzzle = new THREE.Vector3(eye.x, eye.y, eye.z)
        .add(new THREE.Vector3(dir.x, dir.y, dir.z).normalize().multiplyScalar(0.9));
      particles.spawnSmoke(muzzle.x, muzzle.y, muzzle.z);
      const tracer = tracerPool.acquire();
      tracer.visible = true;
      tracer.position.set(eye.x, eye.y, eye.z);
      const traceDir = new THREE.Vector3(dir.x, dir.y, dir.z).normalize();
      const endX = eye.x + traceDir.x * 80;
      const endY = eye.y + traceDir.y * 80;
      const endZ = eye.z + traceDir.z * 80;
      const positions = tracer.geometry.attributes.position;
      positions.setXYZ(0, eye.x, eye.y, eye.z);
      positions.setXYZ(1, endX, endY, endZ);
      positions.needsUpdate = true;
      tracer.geometry.setDrawRange(0, 2);
      activeTracers.add(tracer);
      setTimeout(() => {
        tracerPool.release(tracer);
        activeTracers.delete(tracer);
      }, 100);
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
    camera.updateProjectionMatrix();
    const frustum = new THREE.Frustum();
    frustum.setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
    const attachedToCamera = (obj: THREE.Object3D): boolean => {
      let cur: THREE.Object3D | null = obj.parent;
      while (cur) {
        if (cur === camera) return true;
        cur = cur.parent;
      }
      return false;
    };
    scene.traverse((obj) => {
      if (obj instanceof THREE.Mesh && obj !== ground && !attachedToCamera(obj)) {
        obj.visible = frustum.intersectsObject(obj);
      }
    });
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
