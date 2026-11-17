// save.js — localStorage saves: the story progress, cash, weapons, coins
// and the clock. Autosaves after every completed mission and on Rico's
// phone call; the title screen offers Continue when a save exists.
const SAVE_KEY = 'sunset-harbor-save-v1';

export function saveGame(G) {
  try {
    const p = G.player;
    const data = {
      version: 1,
      savedAt: new Date().toISOString(),
      cash: Math.round(G.cash ?? p.cash),
      health: p.health,
      armor: p.armor,
      weapon: p.weapon,
      weapons: p.weapons,
      missionIndex: G.missionIndex,
      missionsDone: G.missionsDone,
      coinsTaken: G.city.coins.map((c, i) => (c.taken ? i : -1)).filter((i) => i >= 0),
      clockHours: G.clockHours,
      playerX: p.x,
      playerY: p.y,
      taxiDone: G.taxiDone,
      bountiesDone: G.bountiesDone,
      totalEarned: G.totalEarned,
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    G.lastSaveAt = data.savedAt;
    return true;
  } catch {
    return false;
  }
}

export function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || data.version !== 1) return null;
    return data;
  } catch {
    return null;
  }
}

export function hasSave() {
  return loadSave() !== null;
}

export function applySave(G, data) {
  const p = G.player;
  G.cash = data.cash;
  p.cash = data.cash;
  p.health = data.health ?? 100;
  p.armor = data.armor ?? 0;
  p.weapon = data.weapon || 'fists';
  p.weapons = data.weapons || { fists: Infinity };
  G.missionIndex = data.missionIndex ?? 0;
  G.missionsDone = data.missionsDone || [];
  G.clockHours = data.clockHours ?? 18.3;
  p.x = data.playerX ?? p.x;
  p.y = data.playerY ?? p.y;
  G.taxiDone = data.taxiDone || 0;
  G.bountiesDone = data.bountiesDone || 0;
  G.totalEarned = data.totalEarned || 0;
  for (const i of data.coinsTaken || []) {
    if (G.city.coins[i]) G.city.coins[i].taken = true;
  }
  G.coinsCollected = (data.coinsTaken || []).length;
  G.mission = null;
  G.missionStep = 0;
}

export function clearSave() {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch {
    // Storage unavailable: nothing to clear.
  }
}
