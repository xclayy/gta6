// render.js — draws Sunset Harbor: the ground, roads and markings, the
// harbor basin, the beach, buildings with sunset shadows, parks, lamps,
// traffic lights, props and particles, then the time-of-day lighting that
// carries the city from golden sunset through dusk into night.
import { CITY, WORLD_H, PITCH, ROAD, BLOCK, roadCenter, districtAt, DISTRICT_TINTS } from './city.js';
import { drawVehicle } from './vehicles.js';
import { drawPed } from './peds.js';
import { drawEnemy } from './combat.js';
import { drawPlayer } from './player.js';

// Returns { tint, alpha, lampGlow } for the current game clock.
export function lightingFor(hours) {
  const h = ((hours % 24) + 24) % 24;
  if (h >= 17 && h < 18.5) return { color: '#ff9a3c', alpha: 0.10, glow: 0.25 }; // golden hour
  if (h >= 18.5 && h < 19.5) return { color: '#ff5a3c', alpha: 0.16, glow: 0.5 }; // sunset
  if (h >= 19.5 && h < 20.5) return { color: '#7a4a9a', alpha: 0.22, glow: 0.8 }; // dusk
  if (h >= 20.5 || h < 5) return { color: '#1a2a5a', alpha: 0.34, glow: 1 }; // night
  if (h >= 5 && h < 7) return { color: '#ff8a5a', alpha: 0.14, glow: 0.5 }; // dawn
  return { color: '#ffd88a', alpha: 0.05, glow: 0.1 }; // day
}

export function drawWorld(ctx, G) {
  const city = G.city;
  const cam = G.cam;
  const W = G.canvas.width;
  const H = G.canvas.height;
  const view = {
    x0: cam.x - W / 2 - 60, y0: cam.y - H / 2 - 60,
    x1: cam.x + W / 2 + 60, y1: cam.y + H / 2 + 60,
  };
  const visible = (x, y, m = 80) => x > view.x0 - m && x < view.x1 + m && y > view.y0 - m && y < view.y1 + m;

  // Ground: grass base for the whole world.
  ctx.fillStyle = '#5a7a4a';
  ctx.fillRect(view.x0, view.y0, view.x1 - view.x0, view.y1 - view.y0);

  // District tints, faint, so the minimap and the world agree.
  for (let by = 0; by < 12; by++) {
    for (let bx = 0; bx < 12; bx++) {
      const r = { x: bx * PITCH + ROAD, y: by * PITCH + ROAD, w: BLOCK, h: BLOCK };
      if (!visible(r.x + BLOCK / 2, r.y + BLOCK / 2, 200)) continue;
      ctx.fillStyle = DISTRICT_TINTS[districtAt(bx, by)] + '33';
      ctx.fillRect(r.x, r.y, r.w, r.h);
    }
  }

  // Harbor basin water.
  for (const w of city.water) {
    const grad = ctx.createLinearGradient(w.x, w.y, w.x + w.w, w.y + w.h);
    grad.addColorStop(0, '#2a6a8a');
    grad.addColorStop(1, '#1a4a6a');
    ctx.fillStyle = grad;
    ctx.fillRect(w.x, w.y, w.w, w.h);
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 4; i++) {
      const wy = w.y + 30 + i * 90 + Math.sin(G.elapsed * 0.8 + i) * 6;
      ctx.beginPath();
      ctx.moveTo(w.x + 20, wy);
      ctx.lineTo(w.x + w.w - 20, wy);
      ctx.stroke();
    }
  }

  // Beach: sand strip along the south edge, water beyond.
  ctx.fillStyle = '#d8c08a';
  ctx.fillRect(Math.max(view.x0, 0), CITY, Math.min(view.x1, CITY) - Math.max(view.x0, 0), 88);
  ctx.fillStyle = '#1a5a7a';
  ctx.fillRect(Math.max(view.x0, 0), CITY + 88, Math.min(view.x1, CITY) - Math.max(view.x0, 0), 200);
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  for (let i = 0; i < 6; i++) {
    const wx = 200 + i * 520 + Math.sin(G.elapsed * 0.5 + i * 2) * 18;
    ctx.fillRect(wx, CITY + 84, 90, 3);
  }

  // Roads: asphalt with centre dashes and edge lines.
  ctx.fillStyle = '#3a3a40';
  for (let i = 0; i <= 12; i++) {
    ctx.fillRect(roadCenter(i) - ROAD / 2, 0, ROAD, CITY);
    ctx.fillRect(0, roadCenter(i) - ROAD / 2, CITY, ROAD);
  }
  // Sidewalks.
  ctx.fillStyle = '#8a8a8a';
  for (let i = 0; i <= 12; i++) {
    ctx.fillRect(roadCenter(i) - ROAD / 2 - 6, 0, 6, CITY);
    ctx.fillRect(roadCenter(i) + ROAD / 2, 0, 6, CITY);
    ctx.fillRect(0, roadCenter(i) - ROAD / 2 - 6, CITY, 6);
    ctx.fillRect(0, roadCenter(i) + ROAD / 2, CITY, 6);
  }
  // Centre dashes.
  ctx.strokeStyle = '#e8d84a';
  ctx.lineWidth = 3;
  ctx.setLineDash([18, 22]);
  for (let i = 0; i <= 12; i++) {
    ctx.beginPath();
    ctx.moveTo(roadCenter(i), 0);
    ctx.lineTo(roadCenter(i), CITY);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, roadCenter(i));
    ctx.lineTo(CITY, roadCenter(i));
    ctx.stroke();
  }
  ctx.setLineDash([]);
  // Crosswalks at lighted intersections.
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  for (const l of city.lights) {
    for (let s = -2; s <= 2; s++) {
      ctx.fillRect(l.x - 26 + s * 11, l.y - ROAD / 2 - 4, 6, 10);
      ctx.fillRect(l.x - 26 + s * 11, l.y + ROAD / 2 - 6, 6, 10);
    }
  }

  // Parks.
  for (const pk of city.parks) {
    if (!visible(pk.x + 110, pk.y + 110, 150)) continue;
    ctx.fillStyle = '#4a8a3f';
    ctx.fillRect(pk.x, pk.y, pk.w, pk.h);
    ctx.fillStyle = '#6a9a5a';
    ctx.beginPath();
    ctx.arc(pk.x + 110, pk.y + 110, 46, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#7ab8d8';
    ctx.beginPath();
    ctx.arc(pk.x + 60, pk.y + 60, 22, 0, Math.PI * 2);
    ctx.fill();
  }

  // Trees.
  for (const t of city.trees) {
    if (!visible(t.x, t.y)) continue;
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(t.x + 3, t.y + 4, t.r, t.r * 0.6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = t.c;
    ctx.beginPath();
    ctx.arc(t.x, t.y, t.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.beginPath();
    ctx.arc(t.x - 3, t.y - 3, t.r * 0.45, 0, Math.PI * 2);
    ctx.fill();
  }

  // Buildings, with long sunset shadows.
  const sunAngle = 0.7;
  for (const b of city.buildings) {
    if (!visible(b.x + b.w / 2, b.y + b.h / 2, 120)) continue;
    if (b.kind === 'pier') {
      ctx.fillStyle = b.color;
      ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.fillRect(b.x, b.y + b.h - 6, b.w, 6);
      continue;
    }
    const sh = b.height || 6;
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.beginPath();
    ctx.moveTo(b.x + 4, b.y + b.h);
    ctx.lineTo(b.x + 4 + sh, b.y + b.h + sh * 0.5);
    ctx.lineTo(b.x + b.w + sh, b.y + b.h + sh * 0.5);
    ctx.lineTo(b.x + b.w, b.y + b.h);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = b.color;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = b.roof;
    ctx.fillRect(b.x + 4, b.y + 4, b.w - 8, b.h - 8);
    // Windows.
    ctx.fillStyle = 'rgba(255,220,120,0.85)';
    const cols = Math.max(1, Math.floor(b.w / 26));
    const rows = Math.max(1, Math.floor(b.h / 26));
    for (let cx = 0; cx < cols; cx++) {
      for (let cy = 0; cy < rows; cy++) {
        if ((cx * 7 + cy * 3 + b.x) % 5 === 0) continue;
        ctx.fillRect(b.x + 10 + cx * 24, b.y + 10 + cy * 24, 10, 12);
      }
    }
    ctx.strokeStyle = 'rgba(0,0,0,0.4)';
    ctx.lineWidth = 2;
    ctx.strokeRect(b.x, b.y, b.w, b.h);
  }

  // Traffic lights.
  for (const l of city.lights) {
    if (!visible(l.x, l.y)) continue;
    const cycle = (G.elapsed * 0.25 + l.phase) % 16;
    const nsGreen = cycle < 8;
    drawLight(ctx, l.x - ROAD / 2 - 4, l.y - ROAD / 2 - 4, nsGreen ? '#2ad85a' : '#e04030');
    drawLight(ctx, l.x + ROAD / 2 + 4, l.y + ROAD / 2 + 4, nsGreen ? '#e04030' : '#2ad85a');
  }

  // Stunt ramps.
  for (const r of city.ramps) {
    if (!visible(r.x, r.y)) continue;
    ctx.save();
    ctx.translate(r.x, r.y);
    ctx.rotate(r.angle);
    ctx.fillStyle = r.used ? '#5a5a5a' : '#f0a020';
    ctx.beginPath();
    ctx.moveTo(-16, 14);
    ctx.lineTo(16, 14);
    ctx.lineTo(10, -14);
    ctx.lineTo(-10, -14);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#111';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = '#111';
    ctx.font = 'bold 9px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('RAMP', 0, 4);
    ctx.restore();
  }

  // Harbor coins.
  for (const c of city.coins) {
    if (c.taken || !visible(c.x, c.y)) continue;
    const bob = Math.sin(G.elapsed * 3 + c.x) * 2;
    ctx.save();
    ctx.translate(c.x, c.y + bob);
    ctx.fillStyle = '#f0c020';
    ctx.beginPath();
    ctx.arc(0, 0, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#a87800';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = '#a87800';
    ctx.font = 'bold 10px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('$', 0, 3.5);
    ctx.restore();
  }

  // Pay-n-Spray garages.
  for (const key of ['paynspray1', 'paynspray2']) {
    const spot = G.cityPlaces[key];
    if (!visible(spot.x, spot.y)) continue;
    ctx.fillStyle = '#2a4a8a';
    ctx.fillRect(spot.x - 40, spot.y - 26, 80, 52);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('PAY-N-SPRAY', spot.x, spot.y - 32);
    ctx.fillStyle = '#f0c020';
    ctx.font = '10px sans-serif';
    ctx.fillText('$100 · clears wanted', spot.x, spot.y + 4);
  }

  // Named places.
  for (const key of ['garage', 'sals', 'bank', 'warehouse', 'hospital', 'policeHQ', 'marina', 'docks']) {
    const spot = G.cityPlaces[key];
    if (!visible(spot.x, spot.y)) continue;
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(spot.label, spot.x, spot.y - 44);
  }

  // Mission target marker.
  if (G.missionTarget) {
    const t = G.missionTarget;
    const pulse = 1 + Math.sin(G.elapsed * 5) * 0.15;
    ctx.save();
    ctx.translate(t.x, t.y - 26 * pulse);
    ctx.fillStyle = '#f0c020';
    ctx.beginPath();
    ctx.moveTo(0, 14);
    ctx.lineTo(-11, -6);
    ctx.lineTo(11, -6);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#7a5a00';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
    ctx.strokeStyle = 'rgba(240,192,32,0.6)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(t.x, t.y, 26 + Math.sin(G.elapsed * 5) * 5, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Taxi / bounty markers.
  if (G.taxi) {
    const t = G.taxi.phase === 'pickup' ? { x: G.taxi.px, y: G.taxi.py } : { x: G.taxi.dx, y: G.taxi.dy };
    drawMarker(ctx, t.x, t.y, '#2ad85a', '$');
  }
  if (G.bounty) {
    drawMarker(ctx, G.bounty.target.x, G.bounty.target.y, '#e04030', '!');
  }

  // Entities, sorted by y so nearer things draw over farther ones.
  const drawables = [];
  for (const v of G.vehicles) if (!v.dead) drawables.push({ y: v.y, fn: () => drawVehicle(ctx, v) });
  for (const p of G.peds) drawables.push({ y: p.y, fn: () => drawPed(ctx, p) });
  for (const c of G.cops) drawables.push({ y: c.y, fn: () => drawPed(ctx, c) });
  for (const e of G.enemies) drawables.push({ y: e.y, fn: () => drawEnemy(ctx, e) });
  drawables.push({ y: G.player.y, fn: () => drawPlayer(ctx, G.player, G) });
  drawables.sort((a, b) => a.y - b.y);
  for (const d of drawables) d.fn();

  drawParticles(ctx, G);
  drawBulletsLayer(ctx, G);

  // Time-of-day lighting overlay.
  const light = lightingFor(G.clockHours);
  ctx.fillStyle = light.color;
  ctx.globalAlpha = light.alpha;
  ctx.fillRect(view.x0, view.y0, view.x1 - view.x0, view.y1 - view.y0);
  ctx.globalAlpha = 1;
  // Lamp glow at night.
  if (light.glow > 0.5) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const l of city.lamps) {
      if (!visible(l.x, l.y)) continue;
      const g = ctx.createRadialGradient(l.x, l.y, 2, l.x, l.y, 46);
      g.addColorStop(0, 'rgba(255,220,120,0.20)');
      g.addColorStop(1, 'rgba(255,220,120,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(l.x, l.y, 46, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}

function drawLight(ctx, x, y, color) {
  ctx.fillStyle = '#222';
  ctx.fillRect(x - 4, y - 8, 8, 16);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y - 3, 3, 0, Math.PI * 2);
  ctx.fill();
}

function drawMarker(ctx, x, y, color, glyph) {
  const pulse = 1 + Math.sin(performance.now() / 300) * 0.12;
  ctx.save();
  ctx.translate(x, y - 24 * pulse);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, 12);
  ctx.lineTo(-10, -6);
  ctx.lineTo(10, -6);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 11px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(glyph, 0, 2);
  ctx.restore();
}

function drawParticles(ctx, G) {
  for (const pt of G.particles) {
    const k = pt.t / pt.life;
    if (pt.kind === 'smoke') {
      ctx.fillStyle = `rgba(80,80,80,${0.5 * (1 - k)})`;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y - k * 20, 6 + k * 14, 0, Math.PI * 2);
      ctx.fill();
    } else if (pt.kind === 'explosion' || pt.kind === 'fire') {
      ctx.fillStyle = pt.kind === 'fire' ? `rgba(255,${120 + Math.floor(100 * (1 - k))},20,${1 - k})` : `rgba(255,160,40,${1 - k})`;
      ctx.beginPath();
      ctx.arc(pt.x + (Math.random() - 0.5) * 30, pt.y + (Math.random() - 0.5) * 30, 10 + k * 26, 0, Math.PI * 2);
      ctx.fill();
    } else if (pt.kind === 'muzzle') {
      ctx.fillStyle = `rgba(255,233,168,${1 - k})`;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 8 * (1 - k) + 2, 0, Math.PI * 2);
      ctx.fill();
    } else if (pt.kind === 'hit' || pt.kind === 'blood') {
      ctx.fillStyle = pt.kind === 'blood' ? `rgba(200,30,30,${1 - k})` : `rgba(255,255,255,${1 - k})`;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 4, 0, Math.PI * 2);
      ctx.fill();
    } else if (pt.kind === 'spark') {
      ctx.fillStyle = `rgba(255,220,100,${1 - k})`;
      ctx.fillRect(pt.x - 2, pt.y - 2, 4, 4);
    } else if (pt.kind === 'skid') {
      ctx.fillStyle = `rgba(20,20,20,${0.6 * (1 - k)})`;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 5, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function drawBulletsLayer(ctx, G) {
  ctx.save();
  ctx.strokeStyle = '#ffe9a8';
  ctx.lineWidth = 2;
  for (const b of G.bullets) {
    ctx.beginPath();
    ctx.moveTo(b.x - b.vx * 0.02, b.y - b.vy * 0.02);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
  ctx.strokeStyle = '#ff6a5a';
  for (const b of G.enemyBullets) {
    ctx.beginPath();
    ctx.moveTo(b.x - b.vx * 0.02, b.y - b.vy * 0.02);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
  ctx.restore();
}
