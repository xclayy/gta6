// main.js — Sunset Harbor entry point: builds the game state, runs the loop,
// owns the state machine (title / play / pause / phone / menus / incidents),
// the camera, ambient traffic, the clock and the screenshot modes used by
// shots.json (?shot=title|driving|chase|mission).
import { RNG } from './rng.js';
import { buildCity, placePos, PLACES, CITY, WORLD_H, roadCenter } from './city.js';
import { AudioEngine } from './audio.js';
import { Input } from './input.js';
import { makePlayer, updatePlayer, giveStartingGear } from './player.js';
import { makeVehicle, spawnParkedCars, spawnTrafficCar, updateVehicle, VEHICLE_TYPES } from './vehicles.js';
import { spawnPeds, updatePeds } from './peds.js';
import { updatePolice, respawnAfterIncident, addWanted } from './police.js';
import { updateCombat, giveWeapon, WEAPON_ORDER } from './combat.js';
import { startMission, updateMission, MISSIONS } from './missions.js';
import { startTaxiFare, updateTaxi, startBounty, updateBounty, checkRamp, checkPaynspray, callContact, PHONE_CONTACTS } from './activities.js';
import { drawWorld } from './render.js';
import { drawHUD, drawTitle, drawPause, drawPhone, drawHowTo, drawMissionList, drawIncident } from './hud.js';
import { saveGame, loadSave, applySave, hasSave } from './save.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

window.__errors = [];
window.addEventListener('error', (e) => {
  window.__errors.push(String(e.message || e.error));
});

const params = new URLSearchParams(location.search);
const SHOT = params.get('shot') || '';
const SEED = params.get('seed') || 'sunset-harbor-1337';

const city = buildCity(SEED);
const cityPlaces = {};
for (const key of Object.keys(PLACES)) cityPlaces[key] = placePos(city, key);

const G = {
  canvas, ctx,
  city, cityPlaces,
  rng: new RNG(SEED),
  audio: new AudioEngine(),
  input: new Input(canvas),
  state: 'title',
  stateT: 0,
  elapsed: 0,
  clockHours: 18.3,
  cash: 150,
  totalEarned: 0,
  wanted: 0,
  heat: 0,
  lastCrimeT: -100,
  spawnTimer: 0,
  copSpawnTimer: 0,
  roadblockTimer: 10,
  roadblock: null,
  cops: [],
  vehicles: [],
  peds: [],
  enemies: [],
  bullets: [],
  enemyBullets: [],
  particles: [],
  gunfireT: 0,
  shake: 0,
  hudFlash: null,
  missionCompleteBanner: null,
  mission: null,
  missionTarget: null,
  missionIndex: 0,
  missionsDone: [],
  missionKills: 0,
  failedMissionIndex: -1,
  storyComplete: false,
  taxi: null,
  taxiDone: 0,
  bounty: null,
  bountiesDone: 0,
  coinsCollected: 0,
  paynsprayNear: null,
  phoneMessage: '',
  bustedInfo: null,
  wastedInfo: null,
  lastSaveAt: null,
  cam: { x: CITY / 2, y: CITY / 2 },
  mouseWorldX: 0,
  mouseWorldY: 0,
  titleSel: 0,
  titleItems: [],
  pauseSel: 0,
  pauseItems: [],
  phoneSel: 0,
  returnState: 'title',
  shot: SHOT,
};

const garage = cityPlaces.garage;
G.player = makePlayer(garage.x + 20, garage.y + 40);
G.player.cash = G.cash;
G.vehicles = spawnParkedCars(city, new RNG(SEED + '-parked'));
G.peds = spawnPeds(city, new RNG(SEED + '-peds'), 90);
// Mara's starter ride parked on the road outside the garage, facing north.
const starterCar = makeVehicle('coupe', roadCenter(3), garage.y + 40, -Math.PI / 2, { parked: true });
starterCar.color = '#c85a7a';
G.vehicles.push(starterCar);
giveStartingGear(G);

// Expose the live state for automated play-testing (never used by the game).
window.__game = G;

function resize() {
  const scale = Math.min(window.innerWidth / 1280, window.innerHeight / 720);
  canvas.style.width = Math.floor(1280 * scale) + 'px';
  canvas.style.height = Math.floor(720 * scale) + 'px';
}
window.addEventListener('resize', resize);
resize();

function startNewGame() {
  G.state = 'play';
  G.stateT = 0;
  G.audio.ensure();
  G.audio.setRadio(1);
}

function continueGame() {
  const data = loadSave();
  if (data) applySave(G, data);
  G.state = 'play';
  G.stateT = 0;
  G.audio.ensure();
  G.audio.setRadio(1);
}

// --- Menu navigation ---------------------------------------------------------
function menuClick(items, y0, step, width, onPick) {
  const mx = G.input.mouseX;
  const my = G.input.mouseY;
  for (let i = 0; i < items.length; i++) {
    const y = y0 + i * step;
    if (mx > canvas.width / 2 - width / 2 && mx < canvas.width / 2 + width / 2 && my > y - 26 && my < y + 18) {
      onPick(i);
      return true;
    }
  }
  return false;
}

function updateTitle(dt) {
  const items = G.titleItems;
  if (G.input.consume('arrowup') || G.input.consume('w')) G.titleSel = (G.titleSel + items.length - 1) % items.length;
  if (G.input.consume('arrowdown') || G.input.consume('s')) G.titleSel = (G.titleSel + 1) % items.length;
  // Slow cinematic pan over Downtown.
  G.cam.x = CITY / 2 + Math.sin(G.elapsed * 0.05) * 500;
  G.cam.y = CITY / 2 + Math.cos(G.elapsed * 0.04) * 400;
  const pick = (i) => {
    const label = items[i].label;
    if (label === 'NEW GAME') startNewGame();
    else if (label === 'CONTINUE') continueGame();
    else if (label === 'HOW TO PLAY') { G.returnState = 'title'; G.state = 'howto'; }
    else if (label === 'MISSION LIST') { G.returnState = 'title'; G.state = 'missions'; }
  };
  if (G.input.consume('enter') || G.input.consume(' ')) pick(G.titleSel);
  if (G.input.consumeMouse()) menuClick(items, 300, 56, 380, pick);
}

function updatePause(dt) {
  if (G.input.consume('arrowup') || G.input.consume('w')) G.pauseSel = (G.pauseSel + G.pauseItems.length - 1) % G.pauseItems.length;
  if (G.input.consume('arrowdown') || G.input.consume('s')) G.pauseSel = (G.pauseSel + 1) % G.pauseItems.length;
  const pick = (i) => {
    const label = G.pauseItems[i];
    if (label === 'RESUME') G.state = 'play';
    else if (label === 'SAVE GAME') { saveGame(G); G.hudFlash = { text: 'GAME SAVED', t: 1.5 }; G.state = 'play'; }
    else if (label === 'HOW TO PLAY') { G.returnState = 'pause'; G.state = 'howto'; }
    else if (label === 'MISSION LIST') { G.returnState = 'pause'; G.state = 'missions'; }
    else if (label === 'QUIT TO TITLE') { saveGame(G); G.state = 'title'; G.titleSel = 0; }
  };
  if (G.input.consume('enter') || G.input.consume(' ')) pick(G.pauseSel);
  if (G.input.consumeMouse()) menuClick(G.pauseItems, 230, 52, 340, pick);
  if (G.input.pausePressed) G.state = 'play';
}

function updatePhone(dt) {
  if (G.input.consume('arrowup') || G.input.consume('w')) G.phoneSel = (G.phoneSel + PHONE_CONTACTS.length - 1) % PHONE_CONTACTS.length;
  if (G.input.consume('arrowdown') || G.input.consume('s')) G.phoneSel = (G.phoneSel + 1) % PHONE_CONTACTS.length;
  if (G.input.consume('enter') || G.input.consume(' ')) {
    callContact(G, PHONE_CONTACTS[G.phoneSel].key);
  }
  if (G.input.consumeMouse()) {
    const mx = G.input.mouseX;
    const my = G.input.mouseY;
    for (let i = 0; i < PHONE_CONTACTS.length; i++) {
      const y = canvas.height / 2 - 240 + 108 + i * 62;
      if (mx > canvas.width / 2 - 186 && mx < canvas.width / 2 + 186 && my > y - 22 && my < y + 26) {
        G.phoneSel = i;
        callContact(G, PHONE_CONTACTS[i].key);
      }
    }
  }
  if (G.input.phonePressed || G.input.consume('escape')) {
    G.state = 'play';
    G.phoneMessage = '';
  }
}

function updateHowTo() {
  if (G.input.consume('escape') || G.input.consume('enter') || G.input.consumeMouse()) {
    G.state = G.returnState;
  }
}

// --- Play update ---------------------------------------------------------------
function maintainTraffic(dt) {
  const traffic = G.vehicles.filter((v) => v.ai && !v.isPolice);
  const want = 14;
  if (traffic.length < want && G.trafficTimer <= 0) {
    G.trafficTimer = 0.8;
    // Spawn on a road near the camera but off-screen — never on the road
    // the player is driving, so ambient traffic never blocks the player's lane.
    const a = Math.random() * Math.PI * 2;
    const x = G.cam.x + Math.cos(a) * 900;
    const y = G.cam.y + Math.sin(a) * 700;
    if (x > 40 && x < CITY - 40 && y > 40 && y < CITY - 40) {
      const ix = Math.max(0, Math.min(12, Math.round((x - 32) / 284)));
      const iy = Math.max(0, Math.min(12, Math.round((y - 32) / 284)));
      const sx = roadCenter(ix);
      const sy = roadCenter(iy);
      const onPlayerRoad =
        (Math.abs(sy - G.player.y) < 50 && Math.abs(sx - G.player.x) < 700) ||
        (Math.abs(sx - G.player.x) < 50 && Math.abs(sy - G.player.y) < 700);
      if (!onPlayerRoad) {
        const car = spawnTrafficCar(city, G.rng, sx, sy);
        G.vehicles.push(car);
      }
    }
  }
  G.trafficTimer = (G.trafficTimer || 0) - dt;
  // Despawn traffic far away.
  G.vehicles = G.vehicles.filter((v) => {
    if (v.ai && !v.isPolice && !v.target) {
      const d = Math.hypot(v.x - G.cam.x, v.y - G.cam.y);
      if (d > 1400) return false;
    }
    return true;
  });
}

function updatePlay(dt) {
  const p = G.player;
  // Mouse in world space (for aiming).
  G.mouseWorldX = G.cam.x - canvas.width / 2 + G.input.mouseX;
  G.mouseWorldY = G.cam.y - canvas.height / 2 + G.input.mouseY;

  if (G.input.pausePressed) { G.state = 'pause'; G.pauseSel = 0; return; }
  if (G.input.phonePressed) { G.state = 'phone'; G.phoneSel = 0; G.phoneMessage = ''; return; }
  if (G.input.radioPressed) {
    const next = (G.audio.radioStation + 1) % 3;
    G.audio.setRadio(next);
    G.hudFlash = { text: G.audio.radioName(), t: 1.5 };
  }
  if (G.input.weaponPressed) {
    const idx = WEAPON_ORDER.indexOf(p.weapon);
    for (let k = 1; k <= WEAPON_ORDER.length; k++) {
      const next = WEAPON_ORDER[(idx + k) % WEAPON_ORDER.length];
      if (next === 'fists' || (p.weapons[next] || 0) > 0) {
        p.weapon = next;
        break;
      }
    }
    G.audio.blip(500, 0.07, 'square', 0.12);
  }
  if (G.input.consume('m')) {
    if (!G.mission && G.missionIndex < MISSIONS.length) startMission(G, G.missionIndex);
    else if (G.mission) G.hudFlash = { text: 'MISSION IN PROGRESS — ' + G.mission.def.title.toUpperCase(), t: 1.5 };
  }
  // Ambient side-activity offers.
  if (!G.taxi && Math.random() < dt * 0.004 && p.inCar) startTaxiFare(G);
  if (!G.bounty && Math.random() < dt * 0.003 && G.missionsDone[1]) startBounty(G);

  updatePlayer(G, dt);
  for (const v of [...G.vehicles]) updateVehicle(G, v, dt);
  maintainTraffic(dt);
  updatePeds(G, dt);
  updatePolice(G, dt);
  updateCombat(G, dt);
  updateMission(G, dt);
  updateTaxi(G, dt);
  updateBounty(G, dt);
  checkRamp(G);
  checkPaynspray(G, dt);

  // Clock: one game hour every four real minutes.
  G.clockHours = (G.clockHours + dt / 240) % 24;

  // Particles.
  for (const pt of G.particles) pt.t += dt;
  G.particles = G.particles.filter((pt) => pt.t < pt.life);

  // Camera follows the player, with shake.
  const tx = p.x + (p.inCar ? Math.cos(p.angle) * 40 : 0);
  const ty = p.y + (p.inCar ? Math.sin(p.angle) * 40 : 0);
  G.cam.x += (tx - G.cam.x) * Math.min(1, 5 * dt);
  G.cam.y += (ty - G.cam.y) * Math.min(1, 5 * dt);
  G.shake = Math.max(0, G.shake - dt * 26);

  // Audio follows the drive.
  const speed01 = p.inCar ? Math.abs(p.inCar.speed) / VEHICLE_TYPES[p.inCar.type].top : 0;
  G.audio.setEngine(speed01, !!p.inCar);
  G.audio.setSiren(G.wanted > 0 && G.vehicles.some((v) => v.isPolice && v.siren), dt);
  G.audio.updateRadio();

  if (G.hudFlash) G.hudFlash.t -= dt;
  if (G.missionCompleteBanner) G.missionCompleteBanner.t -= dt;
}

// --- Screenshot modes ------------------------------------------------------------
function setupShot() {
  const garagePos = cityPlaces.garage;
  if (SHOT === 'title') {
    G.state = 'title';
    G.clockHours = 18.7;
    return;
  }
  G.state = 'play';
  G.audio.radioStation = 1;
  // In shot mode there is no player at the keyboard: hold the accelerator
  // so the car keeps cruising for the screenshot instead of rolling to a stop.
  G.input.keys.add('w');
  if (SHOT === 'driving') {
    G.clockHours = 18.6;
    const car = makeVehicle('sports', roadCenter(6), roadCenter(6) - 40, 0, {});
    car.driver = 'player';
    car.speed = 260;
    G.vehicles.push(car);
    G.player.inCar = car;
    G.player.x = car.x;
    G.player.y = car.y;
    G.cam.x = car.x - 100;
    G.cam.y = car.y - 60;
    // Traffic on the parallel road to the north, so the player's lane stays clear.
    for (let i = 0; i < 5; i++) {
      const t = spawnTrafficCar(city, G.rng, roadCenter(5 + i), roadCenter(4));
      G.vehicles.push(t);
    }
  } else if (SHOT === 'chase') {
    G.clockHours = 20.9;
    G.wanted = 3;
    G.heat = 80;
    const car = makeVehicle('muscle', roadCenter(7), roadCenter(5), 0, {});
    car.driver = 'player';
    car.speed = 300;
    G.vehicles.push(car);
    G.player.inCar = car;
    G.player.x = car.x;
    G.player.y = car.y;
    for (let i = 0; i < 3; i++) {
      const cop = makeVehicle('police', car.x - 180 - i * 90, car.y + (i - 1) * 60, 0, { ai: true });
      cop.target = G.player;
      cop.driver = 'police';
      cop.siren = true;
      G.vehicles.push(cop);
    }
    G.cam.x = car.x - 80;
    G.cam.y = car.y;
  } else if (SHOT === 'mission') {
    G.clockHours = 18.9;
    startMission(G, 0);
    // Jump to the timed marina leg so the objective, marker and timer show.
    G.mission.step = 2;
    const step = G.mission.def.steps[2];
    G.mission.timer = 96;
    const marina = placePos(city, step.place);
    G.missionTarget = { x: marina.x, y: marina.y, label: step.label };
    const car = makeVehicle('sports', roadCenter(4), roadCenter(3), 0, {});
    car.driver = 'player';
    car.speed = 220;
    car.color = '#e04030';
    G.vehicles.push(car);
    G.player.inCar = car;
    G.player.x = car.x;
    G.player.y = car.y;
    G.player.weapon = 'pistol';
    G.cam.x = car.x - 60;
    G.cam.y = car.y - 40;
  }
}

// --- Main loop -------------------------------------------------------------------
let last = performance.now();
let frames = 0;

function frame(now) {
  requestAnimationFrame(frame);
  let dt = (now - last) / 1000;
  last = now;
  if (dt > 0.05) dt = 0.05;
  G.elapsed += dt;
  G.stateT += dt;

  // Clear + camera transform (with shake).
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#0a0a12';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const shX = G.shake > 0 ? (Math.random() - 0.5) * G.shake : 0;
  const shY = G.shake > 0 ? (Math.random() - 0.5) * G.shake : 0;
  ctx.save();
  ctx.translate(canvas.width / 2 - G.cam.x + shX, canvas.height / 2 - G.cam.y + shY);

  if (G.state === 'title') {
    updateTitle(dt);
    drawWorld(ctx, G);
    ctx.restore();
    drawTitle(ctx, G);
  } else if (G.state === 'play') {
    updatePlay(dt);
    drawWorld(ctx, G);
    ctx.restore();
    drawHUD(ctx, G);
  } else if (G.state === 'pause') {
    drawWorld(ctx, G);
    ctx.restore();
    drawHUD(ctx, G);
    drawPause(ctx, G);
    updatePause(dt);
  } else if (G.state === 'phone') {
    drawWorld(ctx, G);
    ctx.restore();
    drawHUD(ctx, G);
    drawPhone(ctx, G);
    updatePhone(dt);
  } else if (G.state === 'howto') {
    drawWorld(ctx, G);
    ctx.restore();
    drawHowTo(ctx, G);
    updateHowTo();
  } else if (G.state === 'missions') {
    drawWorld(ctx, G);
    ctx.restore();
    drawMissionList(ctx, G);
    updateHowTo();
  } else if (G.state === 'busted' || G.state === 'wasted') {
    drawWorld(ctx, G);
    ctx.restore();
    drawIncident(ctx, G, G.state);
    if (G.input.consume('enter') || G.input.consumeMouse()) respawnAfterIncident(G);
  }

  // In shot mode the world is already set up; nothing interactive runs.
  frames++;
  if (frames === 5) window.__shotReady = true;
  G.input.endFrame();
}

// Audio starts on the first real gesture (browsers require it).
window.addEventListener('pointerdown', () => G.audio.ensure(), { once: true });
window.addEventListener('keydown', () => G.audio.ensure(), { once: true });

if (SHOT) setupShot();
requestAnimationFrame(frame);
