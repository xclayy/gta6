// combat.js — weapons, bullets, drive-by shooting and the enemies who
// shoot back. Fists, pistol, SMG, shotgun and rifle, each with its own
// range, damage, fire rate and ammo.
import { clamp, angleTo } from './rng.js';
import { addWanted, wasted } from './police.js';

export const WEAPONS = {
  fists: { name: 'Fists', dmg: 12, range: 34, rate: 0.38, auto: false, ammo: Infinity, speed: 0, spread: 0, pellets: 1, sound: 'pistol' },
  pistol: { name: 'Pistol', dmg: 22, range: 380, rate: 0.32, auto: false, ammo: 60, speed: 620, spread: 0.03, pellets: 1, sound: 'pistol' },
  smg: { name: 'SMG', dmg: 11, range: 320, rate: 0.09, auto: true, ammo: 120, speed: 680, spread: 0.09, pellets: 1, sound: 'smg' },
  shotgun: { name: 'Shotgun', dmg: 13, range: 240, rate: 0.85, auto: false, ammo: 24, speed: 560, spread: 0.16, pellets: 6, sound: 'shotgun' },
  rifle: { name: 'Rifle', dmg: 42, range: 560, rate: 0.55, auto: false, ammo: 40, speed: 900, spread: 0.01, pellets: 1, sound: 'rifle' },
};

export const WEAPON_ORDER = ['fists', 'pistol', 'smg', 'shotgun', 'rifle'];

export function giveWeapon(G, key, ammo) {
  G.player.weapons[key] = (G.player.weapons[key] || 0) + (ammo ?? WEAPONS[key].ammo);
  if (G.player.weapon === 'fists' || !G.player.weapons[G.player.weapon]) {
    G.player.weapon = key;
  }
}

export function playerShoot(G) {
  const p = G.player;
  const w = WEAPONS[p.weapon];
  if (!w || p.shootCooldown > 0) return;
  if (p.weapon !== 'fists' && (p.weapons[p.weapon] || 0) <= 0) {
    G.audio.blip(180, 0.08, 'square', 0.12);
    G.hudFlash = { text: 'NO AMMO — ' + w.name.toUpperCase(), t: 1.2 };
    p.shootCooldown = 0.3;
    return;
  }
  p.shootCooldown = w.rate;
  p.muzzleT = 0.07;
  G.gunfireT = 1.5;
  if (p.weapon !== 'fists') p.weapons[p.weapon]--;
  G.audio.gunshot(w.sound);

  // Aim: mouse in world space, or facing direction on foot.
  const aim = p.aimAngle;
  for (let i = 0; i < w.pellets; i++) {
    const a = aim + (Math.random() - 0.5) * w.spread * 2;
    G.bullets.push({
      x: p.x + Math.cos(a) * 18,
      y: p.y + Math.sin(a) * 18,
      vx: Math.cos(a) * w.speed,
      vy: Math.sin(a) * w.speed,
      life: w.range / w.speed,
      dmg: w.dmg,
      from: 'player',
    });
  }
  if (p.weapon === 'fists') {
    // Melee swing: hit anything close in front.
    meleeHit(G, p, aim);
  }
  // Firing in public draws the law.
  if (G.wanted < 1) addWanted(G, 1, 'DISCHARGING A FIREARM');
  else G.lastCrimeT = G.elapsed;
  G.shake = Math.min(8, G.shake + (p.weapon === 'shotgun' ? 5 : 2));
  G.particles.push({ x: p.x + Math.cos(aim) * 20, y: p.y + Math.sin(aim) * 20, kind: 'muzzle', t: 0, life: 0.08 });
}

function meleeHit(G, p, aim) {
  const hit = (o) => {
    const d = Math.hypot(o.x - p.x, o.y - p.y);
    if (d < 40 && Math.abs(angleDiff(o, p, aim)) < 1.1) {
      if (o.hp !== undefined) o.hp -= WEAPONS.fists.dmg;
      if (o.state !== undefined && o.state !== 'dead') o.panic = 2;
      return true;
    }
    return false;
  };
  for (const e of G.enemies) hit(e);
  for (const c of G.cops) hit(c);
  for (const pd of G.peds) hit(pd);
}

function angleDiff(o, p, aim) {
  let d = Math.atan2(o.y - p.y, o.x - p.x) - aim;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

export function spawnEnemy(G, x, y, opts = {}) {
  const e = {
    x, y,
    angle: 0,
    hp: opts.hp || 60,
    maxHp: opts.hp || 60,
    weapon: opts.weapon || 'pistol',
    speed: opts.speed || 95,
    state: 'combat',
    shootT: 0.5 + Math.random(),
    walkPhase: Math.random() * 6,
    shirt: opts.shirt || '#3a3a3a',
    color: opts.color || '#d8a080',
    name: opts.name || 'Marlow thug',
    mission: !!opts.mission,
    reward: opts.reward || 0,
  };
  G.enemies.push(e);
  return e;
}

export function updateCombat(G, dt) {
  const p = G.player;
  p.shootCooldown = Math.max(0, (p.shootCooldown || 0) - dt);
  p.muzzleT = Math.max(0, (p.muzzleT || 0) - dt);

  // Player bullets.
  for (const b of G.bullets) {
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
    if (b.life <= 0) continue;
    // Hit enemies.
    for (const e of G.enemies) {
      if (e.hp <= 0) continue;
      if (Math.hypot(e.x - b.x, e.y - b.y) < 16) {
        e.hp -= b.dmg;
        b.life = 0;
        G.particles.push({ x: b.x, y: b.y, kind: 'hit', t: 0, life: 0.25 });
        if (e.hp <= 0) {
          G.cash += e.reward;
          G.particles.push({ x: e.x, y: e.y, kind: 'blood', t: 0, life: 0.5 });
          if (e.mission) G.missionKills = (G.missionKills || 0) + 1;
        }
        break;
      }
    }
    if (b.life <= 0) continue;
    // Hit cops.
    for (const c of G.cops) {
      if (c.hp <= 0) continue;
      if (Math.hypot(c.x - b.x, c.y - b.y) < 16) {
        c.hp -= b.dmg;
        b.life = 0;
        addWanted(G, 1, 'SHOOTING AN OFFICER');
        break;
      }
    }
    if (b.life <= 0) continue;
    // Hit pedestrians (raises wanted, no reward).
    for (const pd of G.peds) {
      if (pd.state === 'dead') continue;
      if (Math.hypot(pd.x - b.x, pd.y - b.y) < 12) {
        pd.state = 'dead';
        b.life = 0;
        addWanted(G, 2, 'CIVILIAN DOWN');
        break;
      }
    }
    if (b.life <= 0) continue;
    // Hit vehicles.
    for (const v of G.vehicles) {
      if (v.dead) continue;
      const dx = Math.abs(b.x - v.x);
      const dy = Math.abs(b.y - v.y);
      if (dx < 26 && dy < 26) {
        v.damage += b.dmg * 0.6;
        b.life = 0;
        break;
      }
    }
  }
  G.bullets = G.bullets.filter((b) => b.life > 0);

  // Enemy / cop bullets.
  for (const b of G.enemyBullets) {
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
    if (b.life <= 0) continue;
    const d = Math.hypot(p.x - b.x, p.y - b.y);
    const radius = p.inCar ? 26 : 12;
    if (d < radius) {
      b.life = 0;
      damagePlayer(G, b.dmg, b.from);
    }
  }
  G.enemyBullets = G.enemyBullets.filter((b) => b.life > 0);

  // Enemies: chase the player and shoot.
  for (const e of G.enemies) {
    if (e.hp <= 0) continue;
    const d = Math.hypot(p.x - e.x, p.y - e.y);
    e.angle = Math.atan2(p.y - e.y, p.x - e.x);
    if (d > 260) {
      e.x += Math.cos(e.angle) * e.speed * dt;
      e.y += Math.sin(e.angle) * e.speed * dt;
      e.walkPhase += dt * 9;
    } else if (d > 140) {
      e.x += Math.cos(e.angle) * e.speed * 0.5 * dt;
      e.y += Math.sin(e.angle) * e.speed * 0.5 * dt;
      e.walkPhase += dt * 6;
    }
    e.shootT -= dt;
    if (e.shootT <= 0 && d < 420 && G.state === 'play') {
      e.shootT = 0.9 + Math.random() * 0.8;
      const w = WEAPONS[e.weapon] || WEAPONS.pistol;
      const spread = (Math.random() - 0.5) * 0.22;
      const a = e.angle + spread;
      G.enemyBullets.push({
        x: e.x, y: e.y,
        vx: Math.cos(a) * w.speed, vy: Math.sin(a) * w.speed,
        life: 1.2, dmg: w.dmg * 0.45, from: 'enemy',
      });
      G.audio.gunshot(w.sound);
      G.gunfireT = 1.2;
    }
  }
  G.enemies = G.enemies.filter((e) => e.hp > 0);
}

export function damagePlayer(G, dmg, from) {
  const p = G.player;
  if (G.state !== 'play' || p.godT > 0) return;
  let rest = dmg;
  if (p.armor > 0) {
    const absorbed = Math.min(p.armor, rest * 0.6);
    p.armor -= absorbed;
    rest -= absorbed;
  }
  p.health -= rest;
  p.hurtT = 0.35;
  G.shake = Math.min(10, G.shake + 3);
  if (p.health <= 0) {
    p.health = 0;
    wasted(G);
  }
}

export function drawBullets(ctx, G) {
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

export function drawEnemy(ctx, e) {
  if (e.hp <= 0) return;
  const bob = Math.sin(e.walkPhase) * 1.5;
  ctx.save();
  ctx.translate(e.x, e.y + bob * 0.3);
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.ellipse(0, 4, 7, 4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.rotate(e.angle + Math.PI / 2);
  ctx.fillStyle = e.shirt;
  ctx.beginPath();
  ctx.arc(0, 0, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = e.color;
  ctx.beginPath();
  ctx.arc(0, -2, 5.5, 0, Math.PI * 2);
  ctx.fill();
  // Gun.
  ctx.fillStyle = '#222';
  ctx.fillRect(-1.5, 6, 3, 9);
  ctx.restore();
  // Health bar.
  if (e.hp < e.maxHp) {
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(e.x - 16, e.y - 22, 32, 4);
    ctx.fillStyle = '#e04030';
    ctx.fillRect(e.x - 16, e.y - 22, 32 * clamp(e.hp / e.maxHp, 0, 1), 4);
  }
}
