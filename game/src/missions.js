// missions.js — the story of Mara Voss: eight jobs for fixer Sal Greco, from
// a welcome-home drive to the bank heist that buys back Rico's garage.
// Each mission is a list of steps: go somewhere, talk, kill, tail, deliver
// against the clock. Rewards pay cash and autosave the game.
import { placePos } from './city.js';
import { spawnEnemy, giveWeapon } from './combat.js';
import { addWanted } from './police.js';
import { makeVehicle } from './vehicles.js';
import { fmtMoney } from './rng.js';
import { saveGame } from './save.js';

export const MISSIONS = [
  {
    id: 'welcome-home', title: 'Welcome Home', reward: 500,
    briefing: [
      { who: 'Sal Greco', text: "Mara Voss. Ten years gone and you walk back into my bar like the tide. Rico's garage is Marlow property now — unless you buy it back." },
      { who: 'Mara', text: "Then I work. What's the first job?" },
      { who: 'Sal Greco', text: "Easy one. Meet me here, take the coupe out back, and show me you can still drive. Marina viewpoint, then back to the garage." },
    ],
    steps: [
      { kind: 'goto', place: 'sals', label: 'Meet Sal at The Anchor Bar' },
      { kind: 'pickupCar', place: 'garage', label: 'Take the coupe at the garage' },
      { kind: 'timed', place: 'marina', label: 'Reach the Marina viewpoint', time: 120 },
      { kind: 'goto', place: 'garage', label: 'Return to the garage' },
    ],
  },
  {
    id: 'first-blood', title: 'First Blood', reward: 800,
    briefing: [
      { who: 'Sal Greco', text: "Marlow's boys are leaning on the dock workers. Three of them, Pier 9. Make it loud — I want the family to hear it." },
      { who: 'Mara', text: 'Loud I can do.' },
    ],
    steps: [
      { kind: 'goto', place: 'docks', label: 'Go to Pier 9' },
      { kind: 'kill', place: 'docks', label: 'Deal with the Marlow thugs (0/3)', count: 3 },
      { kind: 'goto', place: 'sals', label: 'Report back to Sal' },
    ],
  },
  {
    id: 'the-pickup', title: 'The Pickup', reward: 1200,
    briefing: [
      { who: 'Sal Greco', text: "A package is sitting at the Marlow warehouse. Don't ask what's in it. Grab it and bring it to me — fast. HPD has the route watched." },
      { who: 'Mara', text: "Fast is my middle name. Mostly." },
    ],
    steps: [
      { kind: 'goto', place: 'warehouse', label: 'Pick up the package at the warehouse' },
      { kind: 'timed', place: 'sals', label: 'Deliver the package to Sal', time: 100, wanted: 1 },
    ],
  },
  {
    id: 'tail-the-rat', title: 'Tail the Rat', reward: 1500,
    briefing: [
      { who: 'Sal Greco', text: "One of ours is talking to the Marlows. A grey sedan leaves the Docks at dusk. Follow it — don't let him see you — then end it." },
      { who: 'Mara', text: 'He will never see me coming.' },
    ],
    steps: [
      { kind: 'goto', place: 'docks', label: 'Wait at the Docks for the sedan' },
      { kind: 'tail', place: 'docks', label: 'Tail the sedan — stay close, stay unseen', time: 25 },
      { kind: 'kill', place: 'docks', label: 'Deal with the rat', count: 1 },
    ],
  },
  {
    id: 'harbor-run', title: 'Harbor Run', reward: 2000,
    briefing: [
      { who: 'Sal Greco', text: "The family moves product along the harbor road tonight. Three checkpoints, one fast car, no cops on your tail — or at least, none that keep up." },
      { who: 'Mara', text: 'Three checkpoints. One Mara. Deal.' },
    ],
    steps: [
      { kind: 'timed', place: 'marina', label: 'Checkpoint 1 — Marina', time: 60, wanted: 2 },
      { kind: 'timed', place: 'docks', label: 'Checkpoint 2 — Pier 9', time: 70 },
      { kind: 'timed', place: 'garage', label: 'Checkpoint 3 — the garage', time: 70 },
    ],
  },
  {
    id: 'the-warehouse', title: 'The Warehouse', reward: 2500,
    briefing: [
      { who: 'Rico', text: "Mara, it's me. The Marlows keep my old tools in their warehouse. If you hit it, they'll know we're coming for the garage." },
      { who: 'Mara', text: 'Good. Let them know.' },
    ],
    steps: [
      { kind: 'goto', place: 'warehouse', label: 'Reach the Marlow warehouse' },
      { kind: 'kill', place: 'warehouse', label: 'Clear the warehouse guards (0/6)', count: 6 },
      { kind: 'goto', place: 'garage', label: 'Get back to the garage' },
    ],
  },
  {
    id: 'grand-theft', title: 'Grand Theft', reward: 3000,
    briefing: [
      { who: 'Sal Greco', text: "A Marlow limo parks outside the bank every night. Bring it to Rico's garage in one piece and the family pays us to forget it." },
      { who: 'Mara', text: 'A limo. One piece. No promises on the paint.' },
    ],
    steps: [
      { kind: 'goto', place: 'bank', label: 'Find the limo outside the bank' },
      { kind: 'steal', place: 'bank', label: 'Steal the limo' },
      { kind: 'deliverCar', place: 'garage', label: 'Deliver the limo to the garage', wanted: 3 },
    ],
  },
  {
    id: 'the-big-one', title: 'The Big One', reward: 10000,
    briefing: [
      { who: 'Sal Greco', text: 'This is it, Mara. Harbor First Bank. The vault, the guards, the getaway. Do this and Rico gets his garage back tonight.' },
      { who: 'Mara', text: 'For Rico. For the garage. For Sunset Harbor.' },
    ],
    steps: [
      { kind: 'goto', place: 'bank', label: 'Reach Harbor First Bank' },
      { kind: 'kill', place: 'bank', label: 'Take out the bank guards (0/4)', count: 4 },
      { kind: 'hold', place: 'bank', label: 'Crack the vault — hold the bank', time: 20, wanted: 4 },
      { kind: 'timed', place: 'garage', label: 'Escape to the garage!', time: 240 },
    ],
  },
];

export function startMission(G, index) {
  const def = MISSIONS[index];
  if (!def) return false;
  G.missionIndex = index;
  G.mission = {
    def, index, step: 0, timer: 0, tailT: 0, spotted: 0,
    enemies: [], targetCar: null, targetPed: null, stepStarted: false,
    dialogue: def.briefing.slice(), dialogueIdx: 0,
  };
  G.missionKills = 0;
  G.hudFlash = { text: 'MISSION: ' + def.title.toUpperCase(), t: 3 };
  G.audio.phoneRing();
  if (index === 1) giveWeapon(G, 'smg', 120);
  if (index === 5) giveWeapon(G, 'shotgun', 24);
  if (index === 7) giveWeapon(G, 'rifle', 40);
  enterStep(G);
  return true;
}

function stepPos(G, step) {
  if (step.x !== undefined) return { x: step.x, y: step.y };
  return placePos(G.city, step.place);
}

function enterStep(G) {
  const m = G.mission;
  const step = m.def.steps[m.step];
  m.stepStarted = true;
  m.timer = step.time || 0;
  m.tailT = 0;
  m.spotted = 0;
  G.missionKills = 0;
  m.enemies = [];
  const pos = stepPos(G, step);
  G.missionTarget = { x: pos.x, y: pos.y, label: step.label };
  if (step.kind === 'kill') {
    for (let i = 0; i < step.count; i++) {
      const a = (i / step.count) * Math.PI * 2;
      const e = spawnEnemy(G, pos.x + Math.cos(a) * 90, pos.y + Math.sin(a) * 90, {
        hp: 60 + m.index * 8, weapon: m.index >= 5 ? 'smg' : 'pistol', mission: true, reward: 25,
      });
      m.enemies.push(e);
    }
  }
  if (step.kind === 'tail') {
    const car = makeVehicle('sedan', pos.x + 60, pos.y, 0, { ai: true, aiDir: 0, aiSpeed: 110 });
    car.color = '#5a5a5a';
    car.driver = 'traffic';
    G.vehicles.push(car);
    m.targetCar = car;
  }
  if (step.kind === 'steal') {
    const car = makeVehicle('limo', pos.x + 40, pos.y + 40, Math.PI / 2, { parked: true });
    car.color = '#181818';
    G.vehicles.push(car);
    m.targetCar = car;
  }
  if (step.kind === 'pickupCar') {
    const car = makeVehicle('sports', pos.x + 30, pos.y, -Math.PI / 2, { parked: true });
    car.color = '#e04030';
    G.vehicles.push(car);
    m.targetCar = car;
  }
  if (step.wanted) addWanted(G, step.wanted, 'MISSION HEAT');
}

function advanceStep(G) {
  const m = G.mission;
  // Clean up step-specific actors.
  if (m.targetCar && (m.def.steps[m.step].kind === 'tail')) {
    const idx = G.vehicles.indexOf(m.targetCar);
    if (idx >= 0) G.vehicles.splice(idx, 1);
  }
  m.step++;
  if (m.step >= m.def.steps.length) {
    completeMission(G);
    return;
  }
  enterStep(G);
}

export function updateMission(G, dt) {
  const m = G.mission;
  if (!m) return;
  const step = m.def.steps[m.step];
  const pos = stepPos(G, step);
  const p = G.player;
  const d = Math.hypot(p.x - pos.x, p.y - pos.y);

  // Dialogue advances on E / click, but never blocks the mission.
  if (m.dialogueIdx < m.dialogue.length) {
    if (G.input.interactPressed || G.input.consumeMouse()) m.dialogueIdx++;
  }

  if (step.time && (step.kind === 'timed' || step.kind === 'hold')) {
    m.timer -= dt;
    if (m.timer <= 0) {
      if (step.kind === 'hold') {
        advanceStep(G);
        return;
      }
      failMission(G, 'OUT OF TIME');
      return;
    }
  }

  switch (step.kind) {
    case 'goto':
    case 'pickupCar':
      if (d < 55) advanceStep(G);
      break;
    case 'timed':
    case 'deliverCar':
      if (d < 60) advanceStep(G);
      break;
    case 'talk':
      if (d < 55) advanceStep(G);
      break;
    case 'kill': {
      const alive = m.enemies.filter((e) => e.hp > 0).length;
      G.missionTarget.label = step.label.replace(/\(\d+\/\d+\)/, `(${m.enemies.length - alive}/${step.count})`);
      if (alive === 0 && m.enemies.length > 0) advanceStep(G);
      break;
    }
    case 'tail': {
      const car = m.targetCar;
      if (!car || car.dead) { failMission(G, 'YOU LOST THE TARGET'); return; }
      const cd = Math.hypot(p.x - car.x, p.y - car.y);
      if (cd > 340) {
        m.tailT = Math.max(0, m.tailT - dt * 2);
        G.missionTarget.label = 'Tail the sedan — TOO FAR!';
      } else if (cd < 55) {
        m.spotted += dt;
        G.missionTarget.label = 'Tail the sedan — HE SEES YOU!';
        if (m.spotted > 3) { failMission(G, 'YOU WERE SPOTTED'); return; }
      } else {
        m.spotted = Math.max(0, m.spotted - dt);
        m.tailT += dt;
        G.missionTarget.label = `Tail the sedan — stay unseen (${Math.ceil(step.time - m.tailT)}s)`;
      }
      G.missionTarget.x = car.x;
      G.missionTarget.y = car.y;
      if (m.tailT >= step.time) {
        // The rat gets out and fights.
        const ped = spawnEnemy(G, car.x, car.y, { hp: 80, weapon: 'pistol', mission: true, name: 'The Rat', reward: 100 });
        m.targetPed = ped;
        const idx = G.vehicles.indexOf(car);
        if (idx >= 0) G.vehicles.splice(idx, 1);
        advanceStep(G);
        // Next step is a kill step: point it at the rat.
        m.enemies = [ped];
        G.missionTarget = { x: ped.x, y: ped.y, label: 'Deal with the rat' };
      }
      break;
    }
    case 'steal':
      if (p.inCar === m.targetCar) advanceStep(G);
      break;
    case 'hold':
      if (d > 140) {
        failMission(G, 'YOU LEFT THE BANK');
        return;
      }
      break;
    default:
      break;
  }
}

function completeMission(G) {
  const m = G.mission;
  const reward = m.def.reward;
  G.cash += reward;
  G.player.cash = G.cash;
  G.totalEarned += reward;
  G.missionsDone[m.index] = true;
  G.mission = null;
  G.missionTarget = null;
  G.audio.missionDone();
  G.hudFlash = { text: 'MISSION COMPLETE — ' + m.def.title.toUpperCase() + '  +' + fmtMoney(reward), t: 4 };
  G.missionCompleteBanner = { title: m.def.title, reward, t: 4 };
  saveGame(G);
  G.missionIndex = m.index + 1;
  if (G.missionIndex >= MISSIONS.length) {
    G.storyComplete = true;
    G.hudFlash = { text: 'STORY COMPLETE — RICO HAS HIS GARAGE BACK!', t: 6 };
  }
}

export function failMission(G, reason) {
  const m = G.mission;
  if (!m) return;
  for (const e of m.enemies) e.hp = 0;
  if (m.targetCar) {
    const idx = G.vehicles.indexOf(m.targetCar);
    if (idx >= 0 && m.def.steps[m.step].kind === 'tail') G.vehicles.splice(idx, 1);
  }
  G.audio.missionFail();
  G.hudFlash = { text: 'MISSION FAILED — ' + reason, t: 3 };
  G.mission = null;
  G.missionTarget = null;
  G.failedMissionIndex = m.index;
  // The player can retry by visiting Sal again (or pressing M).
}

export function missionObjectiveText(G) {
  if (!G.mission) {
    if (G.missionIndex < MISSIONS.length) {
      return 'Next job: see Sal at The Anchor Bar  (press M to start)';
    }
    return 'Story complete — free roam. Enjoy Sunset Harbor!';
  }
  const m = G.mission;
  const step = m.def.steps[m.step];
  let text = '♪ ' + m.def.title + ' — ' + (G.missionTarget ? G.missionTarget.label : step.label);
  if ((step.kind === 'timed' || step.kind === 'hold') && step.time) {
    text += '  [' + Math.max(0, Math.ceil(m.timer)) + 's]';
  }
  return text;
}
