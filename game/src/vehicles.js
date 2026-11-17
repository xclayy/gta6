// vehicles.js — the nine drivable vehicle types of Sunset Harbor, plus the
// traffic system: parked cars, road-following AI that obeys traffic lights,
// and arcade driving physics with handbrake drifts, damage, smoke and fire.
import { RNG, clamp, angleDiff, dist2 } from './rng.js';
import { CITY, PITCH, ROAD, roadCenter, isRoad, resolveBuildingCollision } from './city.js';

export const VEHICLE_TYPES = {
  sedan: { name: 'Sedan', len: 46, wid: 22, accel: 340, top: 330, grip: 3.4, turn: 2.6, colors: ['#c8c8d0', '#5a7ab8', '#b85a5a', '#7ab85a'] },
  coupe: { name: 'Coupe', len: 44, wid: 21, accel: 380, top: 360, grip: 3.6, turn: 2.8, colors: ['#d8b84a', '#c85a7a', '#4a4a55'] },
  sports: { name: 'Sports', len: 44, wid: 22, accel: 520, top: 470, grip: 4.2, turn: 3.1, colors: ['#e04030', '#f0a020', '#30c8e0'] },
  muscle: { name: 'Muscle', len: 48, wid: 23, accel: 460, top: 400, grip: 3.2, turn: 2.5, colors: ['#7a3a8a', '#2a2a2a', '#c86020'] },
  taxi: { name: 'Taxi', len: 46, wid: 22, accel: 340, top: 330, grip: 3.4, turn: 2.6, colors: ['#f0c020'] },
  van: { name: 'Van', len: 54, wid: 24, accel: 280, top: 280, grip: 3.0, turn: 2.2, colors: ['#c8c8c8', '#7a8a9a', '#8a6a4a'] },
  truck: { name: 'Truck', len: 62, wid: 26, accel: 240, top: 260, grip: 2.8, turn: 2.0, colors: ['#5a6a7a', '#a85a2a', '#4a7a5a'] },
  police: { name: 'HPD Interceptor', len: 48, wid: 22, accel: 480, top: 430, grip: 4.0, turn: 3.0, colors: ['#20242c'] },
  limo: { name: 'Limo', len: 72, wid: 24, accel: 300, top: 310, grip: 3.0, turn: 2.1, colors: ['#181818', '#d8d8d8'] },
};

let nextId = 1;

export function makeVehicle(type, x, y, angle = 0, opts = {}) {
  const t = VEHICLE_TYPES[type];
  return {
    id: nextId++,
    type,
    name: t.name,
    x, y, angle,
    speed: 0,
    velX: 0, velY: 0,
    color: opts.color || t.colors[Math.floor(Math.random() * t.colors.length)],
    damage: opts.damage || 0,
    dead: false,
    burning: false,
    parked: !!opts.parked,
    ai: !!opts.ai,
    aiDir: opts.aiDir || 0, // 0=E 1=S 2=W 3=N
    aiSpeed: opts.aiSpeed || 120,
    aiWait: 0,
    isPolice: type === 'police',
    siren: false,
    target: null, // police chase target
    smokeTimer: 0,
    driver: null, // 'player' | 'traffic' | null
    locked: false,
  };
}

export function spawnParkedCars(city, rng) {
  const cars = [];
  const types = ['sedan', 'coupe', 'sports', 'muscle', 'taxi', 'van', 'truck', 'limo'];
  for (let i = 0; i < 46; i++) {
    const road = rng.int(0, 12);
    const along = rng.float(80, CITY - 80);
    const side = rng.chance(0.5) ? 1 : -1;
    let x, y, angle;
    if (rng.chance(0.5)) {
      x = roadCenter(road) + side * (ROAD / 2 - 12);
      y = along;
      angle = side > 0 ? Math.PI / 2 : -Math.PI / 2;
    } else {
      x = along;
      y = roadCenter(road) + side * (ROAD / 2 - 12);
      angle = side > 0 ? 0 : Math.PI;
    }
    if (isRoad(x, y)) cars.push(makeVehicle(rng.pick(types), x, y, angle, { parked: true }));
  }
  return cars;
}

export function spawnTrafficCar(city, rng, x, y) {
  const types = ['sedan', 'coupe', 'taxi', 'van', 'truck', 'muscle'];
  const vertical = rng.chance(0.5);
  const dir = rng.int(0, 3);
  const car = makeVehicle(rng.pick(types), x, y, (dir * Math.PI) / 2, { ai: true, aiDir: dir, aiSpeed: rng.float(100, 160) });
  car.driver = 'traffic';
  return car;
}

// Traffic-light state: NS green when the cycle is in its first half.
export function lightIsGreen(city, i, j, time) {
  const light = city.lights.find((l) => l.i === i && l.j === j);
  if (!light) return true;
  const cycle = (time * 0.25 + light.phase) % 16;
  return cycle < 8; // NS green first half, EW green second half
}

function lightAhead(city, v, time) {
  // Is the vehicle approaching a red light within one car length?
  const aheadX = v.x + Math.cos(v.angle) * 40;
  const aheadY = v.y + Math.sin(v.angle) * 40;
  const i = Math.round((aheadX - ROAD / 2) / PITCH);
  const j = Math.round((aheadY - ROAD / 2) / PITCH);
  if (i < 1 || j < 1 || i > 11 || j > 11) return false;
  const light = city.lights.find((l) => l.i === i && l.j === j);
  if (!light) return false;
  const cx = roadCenter(i);
  const cy = roadCenter(j);
  const d = Math.hypot(aheadX - cx, aheadY - cy);
  if (d > 55) return false;
  const cycle = (time * 0.25 + light.phase) % 16;
  const nsGreen = cycle < 8;
  const movingNS = Math.abs(Math.sin(v.angle)) > 0.7;
  return movingNS ? !nsGreen : nsGreen;
}

export function updateVehicle(G, v, dt) {
  const t = VEHICLE_TYPES[v.type];
  if (v.dead) return;
  if (v.burning) {
    v.damage += dt * 14;
    if (v.damage >= 130) explodeVehicle(G, v);
    return;
  }
  if (v.damage >= 100 && !v.burning) {
    v.burning = true;
    G.audio.explosion();
    G.particles.push({ x: v.x, y: v.y, kind: 'explosion', t: 0, life: 0.9 });
  }

  if (v.ai) {
    updateTrafficAI(G, v, dt);
  } else if (v.driver === 'player') {
    updatePlayerDriving(G, v, dt);
  }

  // Integrate.
  const fx = Math.cos(v.angle);
  const fy = Math.sin(v.angle);
  v.x += fx * v.speed * dt;
  v.y += fy * v.speed * dt;
  v.x = clamp(v.x, 10, CITY - 10);
  v.y = clamp(v.y, 10, CITY + 70);

  // Collisions with buildings.
  if (resolveBuildingCollision(G.city, v, t.len * 0.42)) {
    if (Math.abs(v.speed) > 120) {
      v.damage += Math.abs(v.speed) * 0.03;
      G.audio.crash();
      G.particles.push({ x: v.x, y: v.y, kind: 'smoke', t: 0, life: 0.6 });
      if (v.driver === 'player') G.shake = Math.min(14, G.shake + 6);
    }
    v.speed *= 0.4;
  }
  // Collisions with other vehicles.
  for (const o of G.vehicles) {
    if (o === v || o.dead) continue;
    const d2 = dist2(v.x, v.y, o.x, o.y);
    const rr = (t.len + VEHICLE_TYPES[o.type].len) * 0.42;
    if (d2 < rr * rr) {
      const d = Math.sqrt(d2) || 1;
      const push = (rr - d) / 2;
      const nx = (v.x - o.x) / d;
      const ny = (v.y - o.y) / d;
      v.x += nx * push;
      v.y += ny * push;
      o.x -= nx * push;
      o.y -= ny * push;
      const impact = Math.abs(v.speed - o.speed);
      if (impact > 90) {
        v.damage += impact * 0.02;
        o.damage += impact * 0.02;
        if (v.driver === 'player' || o.driver === 'player') {
          G.audio.crash();
          G.shake = Math.min(12, G.shake + 4);
        }
      }
      const avg = (v.speed + o.speed) / 2;
      v.speed = avg * 0.7;
      o.speed = avg * 0.7;
    }
  }
  // Smoke when badly damaged.
  if (v.damage > 55) {
    v.smokeTimer -= dt;
    if (v.smokeTimer <= 0) {
      v.smokeTimer = 0.12;
      G.particles.push({ x: v.x - Math.cos(v.angle) * 10, y: v.y - Math.sin(v.angle) * 10, kind: 'smoke', t: 0, life: 0.8 });
    }
  }
}

function updatePlayerDriving(G, v, dt) {
  const t = VEHICLE_TYPES[v.type];
  const input = G.input;
  const fwd = input.up ? 1 : input.down ? -0.6 : 0;
  const steer = (input.left ? -1 : 0) + (input.right ? 1 : 0);
  const handbrake = input.handbrake;
  const dir = v.speed >= 0 ? 1 : -1;

  if (fwd !== 0) v.speed += fwd * t.accel * dt;
  else v.speed -= v.speed * 0.9 * dt;
  if (input.down && v.speed > 0) v.speed -= 500 * dt; // brake
  v.speed = clamp(v.speed, -t.top * 0.45, t.top);

  const grip = handbrake ? 1.4 : t.grip;
  v.angle += steer * t.turn * dir * clamp(Math.abs(v.speed) / 160, 0, 1) * dt * (handbrake ? 1.7 : 1);
  if (handbrake && Math.abs(v.speed) > 140 && steer !== 0) {
    v.speed *= 1 - 0.35 * dt;
    if (Math.random() < 0.3) {
      G.particles.push({ x: v.x, y: v.y, kind: 'skid', t: 0, life: 0.4 });
    }
  }
  // Gentle drag and rolling resistance.
  v.speed -= v.speed * 0.12 * dt;
  void grip;
}

function updateTrafficAI(G, v, dt) {
  const t = VEHICLE_TYPES[v.type];
  if (v.aiWait > 0) {
    v.aiWait -= dt;
    v.speed = Math.max(0, v.speed - 400 * dt);
    return;
  }
  // Police chase overrides traffic behaviour.
  if (v.isPolice && v.target) {
    const want = Math.atan2(v.target.y - v.y, v.target.x - v.x);
    const diff = angleDiff(v.angle, want);
    v.angle += clamp(diff, -2.4 * dt, 2.4 * dt);
    const dist = Math.hypot(v.target.x - v.x, v.target.y - v.y);
    const wantSpeed = dist > 320 ? t.top : dist > 120 ? 300 : 200;
    v.speed += (wantSpeed - v.speed) * 0.8 * dt;
    v.siren = true;
    return;
  }
  v.siren = false;
  // Drive along the current road direction.
  const targetAngle = (v.aiDir * Math.PI) / 2;
  v.angle += angleDiff(v.angle, targetAngle) * Math.min(1, 6 * dt);
  // Stop at red lights.
  if (lightAhead(G.city, v, G.time * 60 + G.tick * 0.016)) {
    v.speed = Math.max(0, v.speed - 500 * dt);
  } else {
    v.speed += (v.aiSpeed - v.speed) * 0.7 * dt;
  }
  // At an intersection, maybe turn.
  const ix = Math.round((v.x - ROAD / 2) / PITCH);
  const iy = Math.round((v.y - ROAD / 2) / PITCH);
  const cx = roadCenter(ix);
  const cy = roadCenter(iy);
  const nearCenter = Math.hypot(v.x - cx, v.y - cy) < 14;
  if (nearCenter && v.speed > 40) {
    const r = Math.random();
    if (r < 0.22) v.aiDir = (v.aiDir + 1) % 4; // right
    else if (r < 0.38) v.aiDir = (v.aiDir + 3) % 4; // left
    // else straight on
    // Keep inside the city: bounce off the edge roads.
    if (ix <= 0 && v.aiDir === 2) v.aiDir = 0;
    if (ix >= 12 && v.aiDir === 0) v.aiDir = 2;
    if (iy <= 0 && v.aiDir === 3) v.aiDir = 1;
    if (iy >= 12 && v.aiDir === 1) v.aiDir = 3;
  }
}

export function explodeVehicle(G, v) {
  v.dead = true;
  v.burning = false;
  G.audio.explosion();
  G.shake = Math.min(20, G.shake + 12);
  G.particles.push({ x: v.x, y: v.y, kind: 'explosion', t: 0, life: 1 });
  for (let i = 0; i < 10; i++) {
    G.particles.push({ x: v.x, y: v.y, kind: 'fire', t: 0, life: 0.7 + Math.random() * 0.5 });
  }
  // Blast hurts nearby actors and raises the heat.
  const blast = (o) => {
    const d = Math.hypot(o.x - v.x, o.y - v.y);
    if (d < 160) {
      if (o === G.player) G.player.health -= 45;
      else if (o.hp !== undefined) o.hp -= 80;
    }
  };
  blast(G.player);
  for (const p of G.peds) blast(p);
  for (const e of G.enemies) blast(e);
  if (v.driver === 'player') {
    G.player.inCar = null;
    G.player.x = v.x + 40;
    G.player.y = v.y;
    G.player.health -= 20;
  }
  G.wanted = Math.min(5, G.wanted + 1);
  setTimeout(() => {
    const idx = G.vehicles.indexOf(v);
    if (idx >= 0) G.vehicles.splice(idx, 1);
  }, 4000);
}

export function drawVehicle(ctx, v) {
  const t = VEHICLE_TYPES[v.type];
  ctx.save();
  ctx.translate(v.x, v.y);
  ctx.rotate(v.angle);
  const L = t.len;
  const W = t.wid;
  // Shadow.
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.ellipse(3, 4, L / 2, W / 2 + 2, 0, 0, Math.PI * 2);
  ctx.fill();
  // Body.
  ctx.fillStyle = v.color;
  roundRect(ctx, -L / 2, -W / 2, L, W, 7);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.45)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  // Cabin / windshield.
  ctx.fillStyle = 'rgba(20,30,44,0.85)';
  const cabL = v.type === 'van' || v.type === 'truck' ? L * 0.42 : L * 0.36;
  const cabX = v.type === 'truck' ? L / 2 - cabL - 4 : -cabL / 2 + 2;
  roundRect(ctx, cabX, -W / 2 + 4, cabL, W - 8, 5);
  ctx.fill();
  // Headlights and tail lights.
  ctx.fillStyle = '#ffe9a8';
  ctx.fillRect(L / 2 - 2, -W / 2 + 2, 3, 5);
  ctx.fillRect(L / 2 - 2, W / 2 - 7, 3, 5);
  ctx.fillStyle = '#ff3b30';
  ctx.fillRect(-L / 2 - 1, -W / 2 + 2, 3, 5);
  ctx.fillRect(-L / 2 - 1, W / 2 - 7, 3, 5);
  if (v.type === 'taxi') {
    ctx.fillStyle = '#f0c020';
    ctx.fillRect(-6, -W / 2 + 1, 12, 4);
    ctx.fillStyle = '#111';
    ctx.font = 'bold 7px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('TAXI', 0, -W / 2 + 9);
  }
  if (v.isPolice) {
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 8px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('HPD', 0, 3);
    // Light bar, flashing.
    const flash = Math.floor(performance.now() / 180) % 2 === 0;
    ctx.fillStyle = flash ? '#ff2a2a' : '#2a6aff';
    ctx.fillRect(-4, -W / 2 - 2, 8, 4);
    ctx.fillStyle = flash ? '#2a6aff' : '#ff2a2a';
    ctx.fillRect(-4, W / 2 - 2, 8, 4);
  }
  if (v.damage > 55) {
    ctx.fillStyle = 'rgba(30,30,30,0.7)';
    ctx.beginPath();
    ctx.arc(-L / 4, 0, 5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

export function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
