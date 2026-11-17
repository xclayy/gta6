// hud.js — everything drawn on top of the world: the HUD (minimap, stars,
// cash, health, weapon, speed, clock, radio), the mission objective line,
// dialogue, banners, and every menu — title, pause, phone, how to play,
// mission list, busted and wasted.
import { CITY, WORLD_H, PITCH, ROAD, roadCenter, districtAt } from './city.js';
import { fmtMoney, fmtClock, clamp } from './rng.js';
import { WEAPONS } from './combat.js';
import { MISSIONS, missionObjectiveText } from './missions.js';
import { PHONE_CONTACTS } from './activities.js';
import { hasSave } from './save.js';

const MINIMAP = 190;

export function drawHUD(ctx, G) {
  const W = G.canvas.width;
  const H = G.canvas.height;
  drawMinimap(ctx, G);
  // Wanted stars, top centre.
  const starY = 26;
  for (let i = 0; i < 5; i++) {
    const x = W / 2 - 70 + i * 30;
    const lit = i < G.wanted;
    const flash = G.wanted >= 3 && Math.floor(G.elapsed * 4) % 2 === 0;
    ctx.font = '26px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = lit ? (flash ? '#ff5040' : '#f0c020') : 'rgba(255,255,255,0.25)';
    ctx.fillText('★', x, starY);
  }
  // Cash, top right.
  ctx.textAlign = 'right';
  ctx.font = 'bold 26px sans-serif';
  ctx.fillStyle = '#7ae07a';
  ctx.strokeStyle = 'rgba(0,0,0,0.7)';
  ctx.lineWidth = 4;
  ctx.strokeText(fmtMoney(G.cash), W - 18, 34);
  ctx.fillText(fmtMoney(G.cash), W - 18, 34);
  ctx.font = '13px sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  ctx.strokeText('Earned: ' + fmtMoney(G.totalEarned), W - 18, 54);
  ctx.fillText('Earned: ' + fmtMoney(G.totalEarned), W - 18, 54);

  // Health / armor bars, bottom right.
  const bx = W - 240;
  const by = H - 66;
  bar(ctx, bx, by, 220, 14, G.player.health / 100, '#e04030', 'HEALTH ' + Math.ceil(G.player.health));
  bar(ctx, bx, by + 20, 220, 10, G.player.armor / 100, '#4a90d8', G.player.armor > 0 ? 'ARMOR ' + Math.ceil(G.player.armor) : 'ARMOR');

  // Weapon + ammo, bottom left.
  const w = WEAPONS[G.player.weapon];
  ctx.textAlign = 'left';
  ctx.font = 'bold 20px sans-serif';
  ctx.fillStyle = '#fff';
  ctx.strokeStyle = 'rgba(0,0,0,0.7)';
  ctx.lineWidth = 4;
  const ammo = G.player.weapons[G.player.weapon];
  const ammoText = ammo === Infinity ? '∞' : String(ammo);
  ctx.strokeText(w.name + '  ·  ' + ammoText, 18, H - 44);
  ctx.fillText(w.name + '  ·  ' + ammoText, 18, H - 44);
  ctx.font = '12px sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.fillText('Q switch weapon · mouse aim · click fire', 18, H - 24);

  // Speed + clock + radio, bottom centre-right.
  if (G.player.inCar) {
    const mph = Math.round(Math.abs(G.player.inCar.speed) * 0.14);
    ctx.textAlign = 'center';
    ctx.font = 'bold 30px sans-serif';
    ctx.fillStyle = '#fff';
    ctx.strokeText(String(mph), W - 330, H - 30);
    ctx.fillText(String(mph), W - 330, H - 30);
    ctx.font = '12px sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.fillText('MPH · ' + G.player.inCar.name, W - 330, H - 12);
  }
  ctx.textAlign = 'center';
  ctx.font = 'bold 18px sans-serif';
  ctx.fillStyle = '#fff';
  ctx.strokeStyle = 'rgba(0,0,0,0.7)';
  ctx.lineWidth = 4;
  ctx.strokeText(fmtClock(G.clockHours), W / 2, H - 18);
  ctx.fillText(fmtClock(G.clockHours), W / 2, H - 18);
  ctx.font = '12px sans-serif';
  ctx.fillStyle = '#ffd88a';
  ctx.fillText(G.audio.radioName(), W / 2, H - 40);

  // Mission objective line, under the stars.
  ctx.textAlign = 'center';
  ctx.font = 'bold 15px sans-serif';
  ctx.fillStyle = '#ffe9a8';
  ctx.strokeStyle = 'rgba(0,0,0,0.7)';
  ctx.lineWidth = 4;
  const obj = missionObjectiveText(G);
  ctx.strokeText(obj, W / 2, 56);
  ctx.fillText(obj, W / 2, 56);

  // Coins counter.
  ctx.textAlign = 'left';
  ctx.font = '13px sans-serif';
  ctx.fillStyle = '#f0c020';
  ctx.fillText('◉ Harbor coins ' + G.coinsCollected + '/40', 18, 78);

  // Flash message.
  if (G.hudFlash && G.hudFlash.t > 0) {
    ctx.textAlign = 'center';
    ctx.font = 'bold 22px sans-serif';
    ctx.fillStyle = '#fff';
    ctx.strokeStyle = 'rgba(0,0,0,0.8)';
    ctx.lineWidth = 5;
    const a = clamp(G.hudFlash.t, 0, 1);
    ctx.globalAlpha = a;
    ctx.strokeText(G.hudFlash.text, W / 2, 96);
    ctx.fillText(G.hudFlash.text, W / 2, 96);
    ctx.globalAlpha = 1;
  }

  // Mission complete banner.
  if (G.missionCompleteBanner && G.missionCompleteBanner.t > 0) {
    const b = G.missionCompleteBanner;
    ctx.save();
    ctx.globalAlpha = clamp(b.t, 0, 1);
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(W / 2 - 260, H / 2 - 70, 520, 110);
    ctx.strokeStyle = '#f0c020';
    ctx.lineWidth = 3;
    ctx.strokeRect(W / 2 - 260, H / 2 - 70, 520, 110);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#f0c020';
    ctx.font = 'bold 30px sans-serif';
    ctx.fillText('MISSION COMPLETE', W / 2, H / 2 - 28);
    ctx.fillStyle = '#fff';
    ctx.font = '20px sans-serif';
    ctx.fillText(b.title + '   +' + fmtMoney(b.reward), W / 2, H / 2 + 8);
    ctx.restore();
  }

  // Dialogue box.
  if (G.mission && G.mission.dialogueIdx < G.mission.dialogue.length) {
    const line = G.mission.dialogue[G.mission.dialogueIdx];
    drawDialogue(ctx, G, line.who, line.text);
  }

  // Damage vignette.
  if (G.player.hurtT > 0) {
    ctx.fillStyle = `rgba(200,30,30,${G.player.hurtT * 0.5})`;
    ctx.fillRect(0, 0, W, H);
  }
  if (G.player.health < 30) {
    const pulse = 0.12 + Math.sin(G.elapsed * 5) * 0.05;
    ctx.strokeStyle = `rgba(200,30,30,${pulse})`;
    ctx.lineWidth = 26;
    ctx.strokeRect(0, 0, W, H);
  }
}

function bar(ctx, x, y, w, h, frac, color, label) {
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(x - 2, y - 2, w + 4, h + 4);
  ctx.fillStyle = '#333';
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w * clamp(frac, 0, 1), h);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 10px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(label, x + 5, y + h - 3);
}

function drawMinimap(ctx, G) {
  const x0 = 14;
  const y0 = 14;
  const s = MINIMAP / CITY;
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.65)';
  ctx.fillRect(x0 - 4, y0 - 4, MINIMAP + 8, MINIMAP * (WORLD_H / CITY) + 8);
  ctx.strokeStyle = '#f0c020';
  ctx.lineWidth = 2;
  ctx.strokeRect(x0 - 4, y0 - 4, MINIMAP + 8, MINIMAP * (WORLD_H / CITY) + 8);
  ctx.beginPath();
  ctx.rect(x0, y0, MINIMAP, MINIMAP * (WORLD_H / CITY));
  ctx.clip();
  // Water + beach.
  ctx.fillStyle = '#1a4a6a';
  ctx.fillRect(x0 + CITY * s * 0.83, y0, MINIMAP * 0.17, MINIMAP * 0.55);
  ctx.fillStyle = '#d8c08a';
  ctx.fillRect(x0, y0 + CITY * s, MINIMAP, MINIMAP * 0.025);
  // Roads.
  ctx.fillStyle = '#7a7a7a';
  for (let i = 0; i <= 12; i++) {
    ctx.fillRect(x0 + roadCenter(i) * s - 1.5, y0, 3, MINIMAP);
    ctx.fillRect(x0, y0 + roadCenter(i) * s - 1.5, MINIMAP, 3);
  }
  const dot = (x, y, color, r = 3) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x0 + x * s, y0 + y * s, r, 0, Math.PI * 2);
    ctx.fill();
  };
  // Blips.
  if (G.missionTarget) dot(G.missionTarget.x, G.missionTarget.y, '#f0c020', 5);
  if (G.taxi) {
    const t = G.taxi.phase === 'pickup' ? { x: G.taxi.px, y: G.taxi.py } : { x: G.taxi.dx, y: G.taxi.dy };
    dot(t.x, t.y, '#2ad85a', 4);
  }
  if (G.bounty) dot(G.bounty.target.x, G.bounty.target.y, '#e04030', 4);
  for (const v of G.vehicles) {
    if (v.isPolice && !v.dead) dot(v.x, v.y, '#2a6aff', 3);
  }
  for (const c of G.cops) dot(c.x, c.y, '#2a6aff', 2);
  // Player arrow.
  const px = x0 + G.player.x * s;
  const py = y0 + G.player.y * s;
  ctx.save();
  ctx.translate(px, py);
  ctx.rotate(G.player.angle);
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.moveTo(7, 0);
  ctx.lineTo(-5, -5);
  ctx.lineTo(-5, 5);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#111';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.restore();
  // North + scale label.
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.font = 'bold 10px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('N ↑  SUNSET HARBOR', x0, y0 + MINIMAP * (WORLD_H / CITY) + 16);
  ctx.restore();
}

function drawDialogue(ctx, G, who, text) {
  const W = G.canvas.width;
  const H = G.canvas.height;
  const bw = Math.min(720, W - 80);
  const bx = (W - bw) / 2;
  const by = H - 190;
  ctx.fillStyle = 'rgba(10,10,16,0.88)';
  ctx.fillRect(bx, by, bw, 92);
  ctx.strokeStyle = '#f0c020';
  ctx.lineWidth = 2;
  ctx.strokeRect(bx, by, bw, 92);
  ctx.textAlign = 'left';
  ctx.fillStyle = '#f0c020';
  ctx.font = 'bold 15px sans-serif';
  ctx.fillText(who.toUpperCase(), bx + 16, by + 24);
  ctx.fillStyle = '#fff';
  ctx.font = '15px sans-serif';
  wrapText(ctx, text, bx + 16, by + 48, bw - 32, 20);
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.font = '12px sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText('E / click ▸', bx + bw - 12, by + 80);
}

function wrapText(ctx, text, x, y, maxW, lh) {
  const words = text.split(' ');
  let line = '';
  let yy = y;
  for (const word of words) {
    const test = line ? line + ' ' + word : word;
    if (ctx.measureText(test).width > maxW && line) {
      ctx.fillText(line, x, yy);
      line = word;
      yy += lh;
    } else {
      line = test;
    }
  }
  ctx.fillText(line, x, yy);
}

// --- Menus -------------------------------------------------------------------
export function drawTitle(ctx, G) {
  const W = G.canvas.width;
  const H = G.canvas.height;
  // Sunset gradient sky over the city backdrop (the world is already drawn).
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, 'rgba(255,122,60,0.55)');
  grad.addColorStop(0.55, 'rgba(122,60,120,0.45)');
  grad.addColorStop(1, 'rgba(10,16,40,0.75)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffe9a8';
  ctx.font = 'bold 15px sans-serif';
  ctx.fillText('M A K E . F U N   ·   G T A 6   B O U N T Y', W / 2, 74);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 64px sans-serif';
  ctx.strokeStyle = 'rgba(0,0,0,0.6)';
  ctx.lineWidth = 8;
  ctx.strokeText('SUNSET HARBOR', W / 2, 150);
  ctx.fillText('SUNSET HARBOR', W / 2, 150);
  ctx.fillStyle = '#f0c020';
  ctx.font = 'italic bold 26px sans-serif';
  ctx.fillText('— Streets of Gold —', W / 2, 188);
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.font = '15px sans-serif';
  ctx.fillText('Mara Voss is home. The Marlows took her brother’s garage.', W / 2, 222);
  ctx.fillText('Eight jobs. One bank. A city that never sleeps.', W / 2, 244);

  const items = [];
  items.push({ label: 'NEW GAME', key: '1' });
  if (hasSave()) items.push({ label: 'CONTINUE', key: '2' });
  items.push({ label: 'HOW TO PLAY', key: '3' });
  items.push({ label: 'MISSION LIST', key: '4' });
  G.titleItems = items;
  const y0 = 300;
  items.forEach((it, i) => {
    const y = y0 + i * 56;
    const sel = G.titleSel === i;
    if (sel) {
      ctx.fillStyle = '#f0c020';
      ctx.fillRect(W / 2 - 190, y - 26, 380, 42);
      ctx.fillStyle = '#111';
    } else {
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(W / 2 - 190, y - 26, 380, 42);
      ctx.fillStyle = '#fff';
    }
    ctx.font = 'bold 20px sans-serif';
    ctx.fillText((sel ? '▸ ' : '') + it.label, W / 2, y + 2);
  });
  ctx.fillStyle = 'rgba(255,255,255,0.65)';
  ctx.font = '13px sans-serif';
  ctx.fillText('↑ ↓ to choose · Enter to confirm · or click a menu item', W / 2, y0 + items.length * 56 + 8);
  ctx.fillText('WASD move · E enter car · mouse aim · click shoot · Space handbrake · T phone · R radio · P pause', W / 2, H - 24);
}

export function drawPause(ctx, G) {
  const W = G.canvas.width;
  const H = G.canvas.height;
  ctx.fillStyle = 'rgba(8,10,20,0.72)';
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 44px sans-serif';
  ctx.fillText('PAUSED', W / 2, 150);
  const items = ['RESUME', 'SAVE GAME', 'HOW TO PLAY', 'MISSION LIST', 'QUIT TO TITLE'];
  G.pauseItems = items;
  items.forEach((label, i) => {
    const y = 230 + i * 52;
    const sel = G.pauseSel === i;
    ctx.fillStyle = sel ? '#f0c020' : 'rgba(255,255,255,0.12)';
    ctx.fillRect(W / 2 - 170, y - 24, 340, 38);
    ctx.fillStyle = sel ? '#111' : '#fff';
    ctx.font = 'bold 19px sans-serif';
    ctx.fillText(label, W / 2, y + 2);
  });
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.font = '14px sans-serif';
  ctx.fillText('Missions done: ' + G.missionsDone.filter(Boolean).length + ' / 8   ·   Cash earned: ' + fmtMoney(G.totalEarned), W / 2, 520);
  if (G.lastSaveAt) ctx.fillText('Last saved: ' + G.lastSaveAt, W / 2, 546);
}

export function drawPhone(ctx, G) {
  const W = G.canvas.width;
  const H = G.canvas.height;
  ctx.fillStyle = 'rgba(8,10,20,0.72)';
  ctx.fillRect(0, 0, W, H);
  const pw = 420;
  const ph = 480;
  const px = W / 2 - pw / 2;
  const py = H / 2 - ph / 2;
  ctx.fillStyle = '#101018';
  ctx.fillRect(px, py, pw, ph);
  ctx.strokeStyle = '#f0c020';
  ctx.lineWidth = 3;
  ctx.strokeRect(px, py, pw, ph);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#f0c020';
  ctx.font = 'bold 22px sans-serif';
  ctx.fillText('☎  MARA’S PHONE', W / 2, py + 40);
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.font = '13px sans-serif';
  ctx.fillText(fmtClock(G.clockHours) + '  ·  ' + fmtMoney(G.cash), W / 2, py + 64);
  PHONE_CONTACTS.forEach((c, i) => {
    const y = py + 108 + i * 62;
    const sel = G.phoneSel === i;
    ctx.fillStyle = sel ? '#f0c020' : 'rgba(255,255,255,0.08)';
    ctx.fillRect(px + 24, y - 22, pw - 48, 48);
    ctx.fillStyle = sel ? '#111' : '#fff';
    ctx.font = 'bold 17px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(c.name, px + 40, y - 2);
    ctx.font = '13px sans-serif';
    ctx.fillStyle = sel ? '#333' : 'rgba(255,255,255,0.7)';
    ctx.fillText(c.desc, px + 40, y + 16);
  });
  if (G.phoneMessage) {
    ctx.fillStyle = 'rgba(255,255,255,0.1)';
    ctx.fillRect(px + 24, py + 380, pw - 48, 66);
    ctx.fillStyle = '#fff';
    ctx.font = '13px sans-serif';
    ctx.textAlign = 'left';
    wrapText(ctx, G.phoneMessage, px + 36, py + 402, pw - 72, 17);
  }
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.font = '12px sans-serif';
  ctx.fillText('↑ ↓ choose · Enter call · T / Esc close', W / 2, py + ph - 14);
}

export function drawHowTo(ctx, G) {
  const W = G.canvas.width;
  const H = G.canvas.height;
  ctx.fillStyle = 'rgba(8,10,20,0.85)';
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#f0c020';
  ctx.font = 'bold 30px sans-serif';
  ctx.fillText('HOW TO PLAY', W / 2, 90);
  const lines = [
    ['WASD / arrows', 'Move on foot · drive when in a car'],
    ['Mouse', 'Aim · click to shoot (drive-by from a car)'],
    ['E', 'Enter / exit a car · advance dialogue'],
    ['Space', 'Handbrake — drift around corners'],
    ['Shift', 'Sprint on foot'],
    ['Q', 'Switch weapon (fists · pistol · SMG · shotgun · rifle)'],
    ['T', 'Phone — Sal, Nia, Rico, HPD tip line'],
    ['R', 'Radio — Sunset FM / Harbor Bass / off'],
    ['M', 'Start the next mission (at Sal’s bar)'],
    ['P / Esc', 'Pause menu'],
    ['', ''],
    ['GOAL', 'Finish all 8 missions to buy back Rico’s garage.'],
    ['', 'Earn cash with taxi fares, bounties, harbor coins and stunts.'],
    ['', 'Wanted stars bring HPD patrols. Pay-n-Spray ($100) clears them.'],
  ];
  ctx.font = '16px sans-serif';
  lines.forEach((l, i) => {
    const y = 140 + i * 30;
    ctx.fillStyle = '#f0c020';
    ctx.textAlign = 'right';
    ctx.font = 'bold 16px sans-serif';
    ctx.fillText(l[0], W / 2 - 60, y);
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'left';
    ctx.font = '16px sans-serif';
    ctx.fillText(l[1], W / 2 - 40, y);
  });
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.font = '13px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Esc / Enter — back', W / 2, H - 30);
}

export function drawMissionList(ctx, G) {
  const W = G.canvas.width;
  const H = G.canvas.height;
  ctx.fillStyle = 'rgba(8,10,20,0.85)';
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#f0c020';
  ctx.font = 'bold 30px sans-serif';
  ctx.fillText('MISSION LIST', W / 2, 90);
  MISSIONS.forEach((m, i) => {
    const y = 140 + i * 52;
    const done = G.missionsDone[i];
    const current = i === G.missionIndex && !done;
    ctx.fillStyle = done ? 'rgba(42,216,90,0.15)' : current ? 'rgba(240,192,32,0.15)' : 'rgba(255,255,255,0.06)';
    ctx.fillRect(W / 2 - 320, y - 26, 640, 44);
    ctx.textAlign = 'left';
    ctx.fillStyle = done ? '#7ae07a' : current ? '#f0c020' : '#fff';
    ctx.font = 'bold 18px sans-serif';
    ctx.fillText((i + 1) + '. ' + m.title + (done ? '  ✓' : current ? '  ◉' : ''), W / 2 - 300, y - 2);
    ctx.textAlign = 'right';
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.font = '15px sans-serif';
    ctx.fillText(fmtMoney(m.reward), W / 2 + 300, y - 2);
    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.font = '13px sans-serif';
    ctx.fillText(m.steps.map((s) => s.label).join('  →  ').slice(0, 90), W / 2 - 300, y + 16);
  });
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.font = '13px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Esc / Enter — back', W / 2, H - 30);
}

export function drawIncident(ctx, G, kind) {
  const W = G.canvas.width;
  const H = G.canvas.height;
  ctx.fillStyle = kind === 'busted' ? 'rgba(20,30,90,0.85)' : 'rgba(90,10,10,0.85)';
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 56px sans-serif';
  ctx.fillText(kind === 'busted' ? 'BUSTED!' : 'WASTED!', W / 2, H / 2 - 40);
  const info = kind === 'busted' ? G.bustedInfo : G.wastedInfo;
  const amount = info ? (kind === 'busted' ? info.fine : info.lost) : 0;
  ctx.font = '20px sans-serif';
  ctx.fillText('HPD took ' + fmtMoney(amount) + '. You wake up at Sunset General.', W / 2, H / 2 + 10);
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.font = '14px sans-serif';
  ctx.fillText('Press Enter to continue', W / 2, H / 2 + 60);
}
