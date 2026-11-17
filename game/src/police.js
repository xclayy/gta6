// police.js — the wanted system: 1-5 stars, patrol cars that chase and ram,
// officers who pursue on foot, roadblocks from 3 stars, and the busted /
// wasted consequences. Heat decays when the player stays out of sight.
import { clamp, dist2 } from './rng.js';
import { CITY, PITCH, ROAD, roadCenter } from './city.js';
import { makeVehicle } from './vehicles.js';

export function wantedFor(crime) {
  return { shoplift: 1, assault: 1, kill: 2, carjack: 1, explosion: 2, shootout: 2 }[crime] || 1;
}

export function addWanted(G, stars, reason = '') {
  if (G.mission && G.mission.noWanted) return;
  const before = G.wanted;
  G.wanted = clamp(G.wanted + stars, 0, 5);
  G.heat = Math.min(100, G.heat + stars * 22);
  G.lastCrimeT = G.elapsed;
  if (G.wanted > before) {
    G.hudFlash = { text: 'WANTED LEVEL ' + G.wanted + (reason ? ' — ' + reason : ''), t: 2.2 };
  }
}

export function updatePolice(G, dt) {
  // Heat decays when the player has not committed a crime recently.
  if (G.elapsed - G.lastCrimeT > 12 && G.wanted > 0) {
    G.heat -= dt * 4;
    if (G.heat <= 0) {
      G.heat = 0;
      G.wanted = Math.max(0, G.wanted - 1);
      G.lastCrimeT = G.elapsed;
      if (G.wanted === 0) {
        G.hudFlash = { text: 'YOU LOST THE COPS', t: 2 };
        clearCops(G);
      }
    }
  }

  // Spawn patrol cars to match the wanted level.
  const wantCars = G.wanted === 0 ? 0 : G.wanted <= 1 ? 1 : G.wanted <= 2 ? 2 : G.wanted <= 3 ? 3 : G.wanted <= 4 ? 4 : 5;
  const patrols = G.vehicles.filter((v) => v.isPolice && !v.dead);
  if (patrols.length < wantCars && G.spawnTimer <= 0) {
    G.spawnTimer = 1.2;
    spawnPatrol(G);
  }
  G.spawnTimer -= dt;

  // Roadblocks from 3 stars: a line of police cars ahead of the player.
  if (G.wanted >= 3 && !G.roadblock && G.roadblockTimer <= 0) {
    G.roadblockTimer = 18;
    makeRoadblock(G);
  }
  if (G.roadblock) {
    G.roadblock.t -= dt;
    if (G.roadblock.t <= 0) {
      for (const v of G.roadblock.cars) {
        const idx = G.vehicles.indexOf(v);
        if (idx >= 0) G.vehicles.splice(idx, 1);
      }
      G.roadblock = null;
    }
  }
  G.roadblockTimer -= dt;

  // Foot officers: they chase the player on foot when wanted >= 1.
  const wantOfficers = G.wanted === 0 ? 0 : G.wanted + 1;
  if (G.cops.length < wantOfficers && G.copSpawnTimer <= 0) {
    G.copSpawnTimer = 2.5;
    const a = Math.random() * Math.PI * 2;
    G.cops.push({
      x: G.player.x + Math.cos(a) * 320,
      y: G.player.y + Math.sin(a) * 320,
      angle: 0, speed: 0, hp: 100, state: 'chase', bustT: 0,
      walkPhase: 0, shirt: '#1a2a4a', color: '#e8c8a0', panic: 0,
    });
  }
  G.copSpawnTimer -= dt;

  for (const c of G.cops) {
    const d = Math.hypot(G.player.x - c.x, G.player.y - c.y);
    if (G.wanted === 0) {
      c.state = 'leave';
    }
    if (c.state === 'leave') {
      c.angle = Math.atan2(c.y - G.player.y, c.x - G.player.x);
      c.x += Math.cos(c.angle) * 90 * dt;
      c.y += Math.sin(c.angle) * 90 * dt;
      if (d > 700) c.gone = true;
      continue;
    }
    // Chase.
    c.angle = Math.atan2(G.player.y - c.y, G.player.x - c.x);
    const inCar = !!G.player.inCar;
    const sp = inCar ? 60 : 132;
    c.x += Math.cos(c.angle) * sp * dt;
    c.y += Math.sin(c.angle) * sp * dt;
    c.walkPhase += dt * 10;
    // Busted: an officer stays on the player for 1.4 seconds on foot.
    if (!inCar && d < 26) {
      c.bustT += dt;
      if (c.bustT > 1.4) {
        busted(G);
        return;
      }
    } else {
      c.bustT = 0;
    }
    // Officers shoot back at 3+ stars when the player is armed.
    if (G.wanted >= 3 && d < 320 && d > 60 && !inCar) {
      c.shootT = (c.shootT || 0) - dt;
      if (c.shootT <= 0) {
        c.shootT = 1.1 + Math.random() * 0.6;
        G.enemyBullets.push({
          x: c.x, y: c.y,
          vx: Math.cos(c.angle) * 420, vy: Math.sin(c.angle) * 420,
          life: 1.1, dmg: 6, from: 'cop',
        });
        G.audio.gunshot('pistol');
      }
    }
  }
  G.cops = G.cops.filter((c) => !c.gone && c.hp > 0);
}

function spawnPatrol(G) {
  const p = G.player;
  const a = Math.random() * Math.PI * 2;
  // Spawn on a nearby road.
  let x = p.x + Math.cos(a) * 420;
  let y = p.y + Math.sin(a) * 420;
  x = clamp(x, 60, CITY - 60);
  y = clamp(y, 60, CITY - 60);
  const ix = Math.round((x - ROAD / 2) / PITCH);
  const iy = Math.round((y - ROAD / 2) / PITCH);
  const car = makeVehicle('police', roadCenter(ix), roadCenter(iy), 0, { ai: true });
  car.target = p;
  car.driver = 'police';
  car.siren = true;
  G.vehicles.push(car);
  G.audio.setSiren(true, 0);
}

function makeRoadblock(G) {
  const p = G.player;
  const ahead = p.inCar ? p.inCar.angle : p.angle;
  const bx = p.x + Math.cos(ahead) * 260;
  const by = p.y + Math.sin(ahead) * 260;
  const cars = [];
  for (let i = -1; i <= 1; i++) {
    const px = bx + Math.cos(ahead + Math.PI / 2) * i * 46;
    const py = by + Math.sin(ahead + Math.PI / 2) * i * 46;
    const car = makeVehicle('police', clamp(px, 40, CITY - 40), clamp(py, 40, CITY - 40), ahead + Math.PI / 2, { ai: false, parked: true });
    car.driver = 'police';
    G.vehicles.push(car);
    cars.push(car);
  }
  G.roadblock = { cars, t: 16, x: bx, y: by };
  G.hudFlash = { text: 'ROADBLOCK AHEAD', t: 2 };
}

export function clearCops(G) {
  for (const v of G.vehicles) {
    if (v.isPolice && v.ai) {
      v.target = null;
      v.ai = true;
      v.aiDir = Math.floor(Math.random() * 4);
      v.siren = false;
    }
  }
  G.cops = [];
  G.audio.setSiren(false, 0);
}

export function busted(G) {
  if (G.state !== 'play') return;
  const fine = Math.min(G.cash, 250 + G.wanted * 150);
  G.cash -= fine;
  G.wanted = 0;
  G.heat = 0;
  clearCops(G);
  G.state = 'busted';
  G.stateT = 0;
  G.bustedInfo = { fine };
  G.audio.missionFail();
  G.audio.setSiren(false, 0);
}

export function wasted(G) {
  if (G.state !== 'play') return;
  const lost = Math.min(G.cash, 200 + G.wanted * 120);
  G.cash -= lost;
  G.wanted = 0;
  G.heat = 0;
  clearCops(G);
  G.state = 'wasted';
  G.stateT = 0;
  G.wastedInfo = { lost };
  G.audio.missionFail();
}

export function respawnAfterIncident(G) {
  const hosp = G.cityPlaces.hospital;
  G.player.x = hosp.x + 30;
  G.player.y = hosp.y + 30;
  G.player.health = 100;
  G.player.armor = 0;
  G.player.inCar = null;
  G.player.angle = 0;
  G.state = 'play';
  G.cam.x = G.player.x;
  G.cam.y = G.player.y;
}
