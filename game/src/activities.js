// activities.js — the side life of Sunset Harbor: taxi fares, bounty
// targets, stunt ramps, Pay-n-Spray, and the phone (T) — Sal, Nia, Rico
// and the HPD tip line.
import { placePos, roadCenter, PITCH, ROAD, CITY } from './city.js';
import { spawnEnemy } from './combat.js';
import { clearCops } from './police.js';
import { makeVehicle } from './vehicles.js';
import { fmtMoney } from './rng.js';
import { saveGame } from './save.js';

// --- Taxi fares ------------------------------------------------------------
export function startTaxiFare(G) {
  if (G.taxi) return;
  const p = G.player;
  // A fare appears near the player, wants to go across town.
  const dest = randomRoadPoint(G);
  const pickup = { x: p.x + (Math.random() - 0.5) * 300, y: p.y + (Math.random() - 0.5) * 300 };
  G.taxi = {
    phase: 'pickup',
    px: pickup.x, py: pickup.y,
    dx: dest.x, dy: dest.y,
    timer: 90,
    fare: 120 + Math.floor(Math.random() * 180),
    passenger: null,
  };
  G.hudFlash = { text: 'TAXI FARE — pick up the passenger', t: 2 };
  G.audio.phoneRing();
}

export function updateTaxi(G, dt) {
  const t = G.taxi;
  if (!t) return;
  const p = G.player;
  t.timer -= dt;
  if (t.timer <= 0) {
    G.hudFlash = { text: 'FARE LOST — the passenger gave up', t: 2 };
    G.taxi = null;
    return;
  }
  if (t.phase === 'pickup') {
    if (Math.hypot(p.x - t.px, p.y - t.py) < 40 && p.inCar) {
      t.phase = 'dropoff';
      t.timer = 110;
      G.hudFlash = { text: 'PASSENGER ABOARD — drive to the marker', t: 2 };
    }
  } else if (Math.hypot(p.x - t.dx, p.y - t.dy) < 55 && p.inCar) {
    G.cash += t.fare;
    G.player.cash = G.cash;
    G.totalEarned += t.fare;
    G.taxiDone++;
    G.audio.missionDone();
    G.hudFlash = { text: 'FARE COMPLETE  +' + fmtMoney(t.fare), t: 2.5 };
    G.taxi = null;
  }
}

function randomRoadPoint(G) {
  const i = 1 + Math.floor(Math.random() * 11);
  const j = 1 + Math.floor(Math.random() * 11);
  return { x: roadCenter(i), y: roadCenter(j) };
}

// --- Bounty targets ---------------------------------------------------------
export function startBounty(G) {
  if (G.bounty) return;
  const spot = randomRoadPoint(G);
  const target = spawnEnemy(G, spot.x, spot.y, {
    hp: 120, weapon: 'smg', name: 'Bounty: Dagger Dan', reward: 400,
    shirt: '#8a2a2a', color: '#e8c8a0',
  });
  G.bounty = { target, reward: 400, timer: 180 };
  G.hudFlash = { text: 'BOUNTY — take down Dagger Dan  (+$400)', t: 3 };
  G.audio.phoneRing();
}

export function updateBounty(G, dt) {
  const b = G.bounty;
  if (!b) return;
  b.timer -= dt;
  if (b.target.hp <= 0) {
    G.cash += b.reward;
    G.player.cash = G.cash;
    G.totalEarned += b.reward;
    G.bountiesDone++;
    G.audio.missionDone();
    G.hudFlash = { text: 'BOUNTY COLLECTED  +' + fmtMoney(b.reward), t: 3 };
    G.bounty = null;
    return;
  }
  if (b.timer <= 0) {
    G.hudFlash = { text: 'BOUNTY EXPIRED — Dan slipped away', t: 2 };
    b.target.hp = 0;
    G.bounty = null;
  }
}

// --- Stunt ramps -------------------------------------------------------------
export function checkRamp(G) {
  const p = G.player;
  if (!p.inCar) return;
  for (const r of G.city.ramps) {
    if (r.used) continue;
    if (Math.hypot(p.x - r.x, p.y - r.y) < 34 && Math.abs(p.inCar.speed) > 200) {
      r.used = true;
      const bonus = 150 + Math.floor(Math.abs(p.inCar.speed) / 4);
      G.cash += bonus;
      G.player.cash = G.cash;
      G.totalEarned += bonus;
      G.audio.pickup();
      G.hudFlash = { text: 'STUNT JUMP!  STYLE BONUS +' + fmtMoney(bonus), t: 2.5 };
      G.shake = Math.min(10, G.shake + 5);
      for (let i = 0; i < 12; i++) {
        G.particles.push({ x: p.x, y: p.y, kind: 'spark', t: 0, life: 0.6 });
      }
    }
  }
}

// --- Pay-n-Spray ---------------------------------------------------------------
export function checkPaynspray(G, dt) {
  const p = G.player;
  if (!p.inCar) return;
  for (const key of ['paynspray1', 'paynspray2']) {
    const spot = placePos(G.city, key);
    if (Math.hypot(p.x - spot.x, p.y - spot.y) < 48) {
      G.paynsprayNear = key;
      if (G.cash >= 100 && (G.wanted > 0 || p.inCar.damage > 5)) {
        G.cash -= 100;
        G.player.cash = G.cash;
        G.wanted = 0;
        G.heat = 0;
        p.inCar.damage = 0;
        p.inCar.burning = false;
        p.inCar.color = p.inCar.color; // repaint keeps the same color
        G.audio.pickup();
        G.hudFlash = { text: 'PAY-N-SPRAY — clean ride, clean record  (-$100)', t: 2.5 };
        // Drive out so it does not retrigger instantly.
        p.inCar.x += 90;
      }
      return;
    }
  }
  G.paynsprayNear = null;
}

// --- Phone (T) ------------------------------------------------------------------
export const PHONE_CONTACTS = [
  { key: 'sal', name: 'Sal Greco', desc: 'Fixer — next job' },
  { key: 'nia', name: 'Nia', desc: 'Car delivery — $150' },
  { key: 'rico', name: 'Rico', desc: 'Brother — save game' },
  { key: 'hpd', name: 'HPD Tip Line', desc: 'Clear wanted — $300' },
];

export function callContact(G, key) {
  const p = G.player;
  if (key === 'sal') {
    if (G.mission) {
      G.phoneMessage = 'Sal: "Finish the job you are on, Mara. Then we talk."';
    } else if (G.missionIndex < 8) {
      G.phoneMessage = 'Sal: "Come to the Anchor Bar. I have work for you."';
    } else {
      G.phoneMessage = 'Sal: "You did it, kid. The garage is yours. Drinks are on me."';
    }
    G.audio.phoneRing();
  } else if (key === 'nia') {
    if (G.cash < 150) {
      G.phoneMessage = 'Nia: "Delivery is $150, hon. Call me when you have it."';
      return;
    }
    G.cash -= 150;
    G.player.cash = G.cash;
    const types = ['sports', 'muscle', 'coupe'];
    const car = makeVehicle(types[Math.floor(Math.random() * types.length)], p.x + 70, p.y + 20, 0, { parked: true });
    G.vehicles.push(car);
    G.phoneMessage = 'Nia: "A ' + car.name + ' is waiting outside for you. Drive safe."';
    G.audio.phoneRing();
  } else if (key === 'rico') {
    saveGame(G);
    G.phoneMessage = 'Rico: "Game saved, sis. I am proud of you. Get my garage back."';
    G.audio.pickup();
  } else if (key === 'hpd') {
    if (G.cash < 300) {
      G.phoneMessage = 'Tip line: "A clean record costs $300. You are short."';
      return;
    }
    if (G.wanted === 0) {
      G.phoneMessage = 'Tip line: "Your record is already clean. Save your money."';
      return;
    }
    G.cash -= 300;
    G.player.cash = G.cash;
    G.wanted = 0;
    G.heat = 0;
    clearCops(G);
    G.phoneMessage = 'Tip line: "Consider it handled. The heat is off — $300."';
    G.audio.pickup();
  }
}
