// player.js — Mara Voss on foot: walking, running, entering and leaving
// cars, and picking up cash, weapons and armor around the city.
import { clamp } from './rng.js';
import { CITY, WORLD_H, resolveBuildingCollision, inWater } from './city.js';
import { VEHICLE_TYPES } from './vehicles.js';
import { addWanted } from './police.js';
import { giveWeapon, playerShoot } from './combat.js';

export function makePlayer(x, y) {
  return {
    x, y,
    angle: -Math.PI / 2,
    aimAngle: 0,
    speed: 0,
    health: 100,
    armor: 0,
    cash: 150,
    inCar: null,
    weapon: 'fists',
    weapons: { fists: Infinity },
    shootCooldown: 0,
    muzzleT: 0,
    hurtT: 0,
    godT: 0,
    walkPhase: 0,
    moving: false,
    carjackT: 0,
  };
}

export function updatePlayer(G, dt) {
  const p = G.player;
  const input = G.input;
  p.hurtT = Math.max(0, p.hurtT - dt);
  p.godT = Math.max(0, p.godT - dt);

  if (p.inCar) {
    // The car update lives in vehicles.js; the player rides along.
    const v = p.inCar;
    p.x = v.x;
    p.y = v.y;
    p.angle = v.angle;
    p.aimAngle = Math.atan2(G.mouseWorldY - p.y, G.mouseWorldX - p.x);
    if (input.enterPressed) {
      exitCar(G);
    }
    // Drive-by shooting.
    if (input.mouseDown && p.weapon !== 'fists') {
      playerShoot(G);
    }
    return;
  }

  // On foot.
  let mx = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  let my = (input.down ? 1 : 0) - (input.up ? 1 : 0);
  const len = Math.hypot(mx, my);
  p.moving = len > 0;
  if (len > 0) {
    mx /= len;
    my /= len;
    const run = input.run ? 235 : 150;
    p.x += mx * run * dt;
    p.y += my * run * dt;
    p.angle = Math.atan2(my, mx);
    p.walkPhase += dt * (input.run ? 13 : 9);
  }
  p.x = clamp(p.x, 12, CITY - 12);
  p.y = clamp(p.y, 12, WORLD_H - 12);
  resolveBuildingCollision(G.city, p, 11);
  if (inWater(G.city, p.x, p.y)) {
    // The harbor is not swimmable: push Mara back onto the quay.
    p.x = clamp(p.x, 12, CITY - 12);
    p.y = clamp(p.y, 12, CITY - 12);
  }
  p.aimAngle = Math.atan2(G.mouseWorldY - p.y, G.mouseWorldX - p.x);

  // Enter a nearby car.
  if (input.enterPressed) {
    tryEnterCar(G);
  }
  // Shoot (mouse held).
  if (input.mouseDown) {
    playerShoot(G);
  }

  // Pick up coins.
  for (const c of G.city.coins) {
    if (!c.taken && Math.hypot(c.x - p.x, c.y - p.y) < 22) {
      c.taken = true;
      G.coinsCollected++;
      G.cash += 50;
      G.audio.coin();
      G.hudFlash = { text: 'HARBOR COIN +' + G.coinsCollected + '/40  ($50)', t: 1.4 };
    }
  }
}

export function tryEnterCar(G) {
  const p = G.player;
  let best = null;
  let bestD = 60;
  for (const v of G.vehicles) {
    if (v.dead || v.burning) continue;
    const d = Math.hypot(v.x - p.x, v.y - p.y);
    if (d < bestD) {
      bestD = d;
      best = v;
    }
  }
  if (!best) return;
  if (best.driver === 'traffic' || best.driver === 'police') {
    // Carjacking: the driver flees, the law notices.
    best.driver = null;
    addWanted(G, 1, 'GRAND THEFT AUTO');
    const a = Math.atan2(p.y - best.y, p.x - best.x);
    G.peds.push({
      id: 1000 + Math.floor(Math.random() * 9000),
      x: best.x + Math.cos(a) * 30, y: best.y + Math.sin(a) * 30,
      angle: a, speed: 40, color: '#e8c8a0', shirt: '#4a7ad8',
      state: 'flee', fleeX: 0, fleeY: 0, fleeT: 0, panic: 3, walkPhase: 0,
      targetBX: 0, targetBY: 0, idleT: 0,
    });
    G.hudFlash = { text: 'CARJACKED — ' + best.name.toUpperCase(), t: 1.6 };
  }
  best.ai = false;
  best.parked = false;
  best.driver = 'player';
  p.inCar = best;
  p.x = best.x;
  p.y = best.y;
  G.audio.blip(300, 0.12, 'sine', 0.15, 520);
}

export function exitCar(G) {
  const p = G.player;
  const v = p.inCar;
  if (!v) return;
  v.driver = null;
  v.speed *= 0.4;
  p.inCar = null;
  p.x = v.x + Math.cos(v.angle + Math.PI / 2) * 26;
  p.y = v.y + Math.sin(v.angle + Math.PI / 2) * 26;
  p.x = clamp(p.x, 12, CITY - 12);
  p.y = clamp(p.y, 12, CITY - 12);
}

export function drawPlayer(ctx, p, G) {
  if (p.inCar) return; // the car is drawn instead
  const bob = p.moving ? Math.sin(p.walkPhase) * 2 : 0;
  ctx.save();
  ctx.translate(p.x, p.y + bob * 0.3);
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath();
  ctx.ellipse(0, 5, 8, 4.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.rotate(p.angle + Math.PI / 2);
  // Mara: red jacket, dark hair.
  ctx.fillStyle = '#c22a2a';
  ctx.beginPath();
  ctx.arc(0, 0, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#2a1a12';
  ctx.beginPath();
  ctx.arc(0, -2, 5.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#e8c8a0';
  ctx.beginPath();
  ctx.arc(0, -3, 3.5, 0, Math.PI * 2);
  ctx.fill();
  // Weapon in hand.
  if (p.weapon !== 'fists') {
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(-1.5, 6, 3, 10);
  }
  if (p.muzzleT > 0) {
    ctx.fillStyle = '#ffe9a8';
    ctx.beginPath();
    ctx.arc(0, 18, 6, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  // Aim indicator.
  if (p.weapon !== 'fists' && G.state === 'play') {
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.75)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(G.mouseWorldX, G.mouseWorldY, 9, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(G.mouseWorldX - 13, G.mouseWorldY);
    ctx.lineTo(G.mouseWorldX - 5, G.mouseWorldY);
    ctx.moveTo(G.mouseWorldX + 5, G.mouseWorldY);
    ctx.lineTo(G.mouseWorldX + 13, G.mouseWorldY);
    ctx.moveTo(G.mouseWorldX, G.mouseWorldY - 13);
    ctx.lineTo(G.mouseWorldX, G.mouseWorldY - 5);
    ctx.moveTo(G.mouseWorldX, G.mouseWorldY + 5);
    ctx.lineTo(G.mouseWorldX, G.mouseWorldY + 13);
    ctx.stroke();
    ctx.restore();
  }
}

export function giveStartingGear(G) {
  giveWeapon(G, 'pistol', 60);
  G.player.weapon = 'pistol';
}
