// peds.js — pedestrians: Harbor locals who stroll the sidewalks, chat in
// place, and run screaming from gunfire. Plus the officer-on-foot behaviour
// used by the wanted system.
import { RNG, clamp, angleTo, dist2 } from './rng.js';
import { CITY, PITCH, ROAD, blockRect, resolveBuildingCollision, inWater } from './city.js';

const PED_COLORS = ['#e07a5f', '#5f8ae0', '#7ae05f', '#e0c05f', '#a05fe0', '#e05f9a', '#5fd8e0', '#c8b8a8'];
const PED_SHIRTS = ['#d84a4a', '#4a7ad8', '#4aa84a', '#d8a84a', '#8a4ad8', '#d84a9a', '#3a9ab8', '#8a6a4a'];

export function spawnPeds(city, rng, count = 90) {
  const peds = [];
  for (let i = 0; i < count; i++) {
    const bx = rng.int(0, 11);
    const by = rng.int(0, 11);
    const r = blockRect(bx, by);
    // Stand on the sidewalk ring around a block.
    const edge = rng.int(0, 3);
    let x, y;
    if (edge === 0) { x = r.x + rng.float(0, 220); y = r.y - 8; }
    else if (edge === 1) { x = r.x + rng.float(0, 220); y = r.y + 220 + 8; }
    else if (edge === 2) { x = r.x - 8; y = r.y + rng.float(0, 220); }
    else { x = r.x + 220 + 8; y = r.y + rng.float(0, 220); }
    x = clamp(x, 8, CITY - 8);
    y = clamp(y, 8, CITY - 8);
    peds.push({
      id: i,
      x, y,
      angle: rng.float(0, Math.PI * 2),
      speed: rng.float(22, 46),
      color: rng.pick(PED_COLORS),
      shirt: rng.pick(PED_SHIRTS),
      state: 'stroll',
      fleeX: 0, fleeY: 0, fleeT: 0,
      panic: 0,
      walkPhase: rng.float(0, Math.PI * 2),
      targetBX: bx, targetBY: by,
      idleT: rng.float(0, 4),
    });
  }
  return peds;
}

export function updatePeds(G, dt) {
  const px = G.player.x;
  const py = G.player.y;
  const gunfire = G.gunfireT > 0;
  for (const p of G.peds) {
    if (p.state === 'dead') continue;
    if (gunfire || p.panic > 0) {
      // Flee away from the player / gunfire.
      const d = Math.hypot(p.x - px, p.y - py);
      if (d < 420) {
        p.state = 'flee';
        p.panic = Math.max(p.panic, 1.2);
        const a = angleTo(px, py, p.x, p.y) + (Math.random() - 0.5) * 0.6;
        p.angle = a;
        const sp = 150;
        p.x += Math.cos(a) * sp * dt;
        p.y += Math.sin(a) * sp * dt;
        p.walkPhase += dt * 14;
      }
      p.panic -= dt;
      if (p.panic <= 0 && d > 420) p.state = 'stroll';
    } else {
      p.state = 'stroll';
      p.idleT -= dt;
      if (p.idleT <= 0) {
        // Pick a new stroll heading along the sidewalk grid.
        p.angle = (Math.floor(Math.random() * 4) * Math.PI) / 2;
        p.idleT = 2 + Math.random() * 4;
      }
      p.x += Math.cos(p.angle) * p.speed * dt;
      p.y += Math.sin(p.angle) * p.speed * dt;
      p.walkPhase += dt * 7;
    }
    p.x = clamp(p.x, 8, CITY - 8);
    p.y = clamp(p.y, 8, CITY + 60);
    resolveBuildingCollision(G.city, p, 10);
    if (inWater(G.city, p.x, p.y)) {
      p.x = clamp(p.x, 8, CITY - 8);
      p.y = clamp(p.y, 8, CITY - 8);
    }
  }
  G.gunfireT = Math.max(0, G.gunfireT - dt);
}

export function drawPed(ctx, p) {
  if (p.state === 'dead') return;
  const bob = Math.sin(p.walkPhase) * 1.5;
  ctx.save();
  ctx.translate(p.x, p.y + bob * 0.3);
  // Shadow.
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.ellipse(0, 4, 7, 4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.rotate(p.angle + Math.PI / 2);
  // Body.
  ctx.fillStyle = p.shirt;
  ctx.beginPath();
  ctx.arc(0, 0, 7, 0, Math.PI * 2);
  ctx.fill();
  // Head.
  ctx.fillStyle = p.color;
  ctx.beginPath();
  ctx.arc(0, -2, 5, 0, Math.PI * 2);
  ctx.fill();
  // Direction tick.
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fillRect(-1, 5, 2, 4);
  ctx.restore();
  if (p.state === 'flee') {
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('!', p.x, p.y - 14);
  }
}

export function nearestPed(G, x, y, maxDist) {
  let best = null;
  let bestD = maxDist * maxDist;
  for (const p of G.peds) {
    if (p.state === 'dead') continue;
    const d = dist2(x, y, p.x, p.y);
    if (d < bestD) {
      bestD = d;
      best = p;
    }
  }
  return best;
}
