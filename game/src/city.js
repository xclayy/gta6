// city.js — Sunset Harbor: a seeded 12x12-block coastal city.
// Roads form a grid; blocks hold buildings, parks, the harbor basin and the
// beach. Every named place the story needs (Sal's bar, the garage, the bank,
// the warehouse, the hospital, Pay-n-Spray) is a fixed address in this grid.
import { RNG, clamp } from './rng.js';

export const BLOCK = 220;
export const ROAD = 64;
export const PITCH = BLOCK + ROAD; // 284
export const GRID = 12; // blocks per side
export const CITY = GRID * BLOCK + (GRID + 1) * ROAD; // 3472
export const BEACH_H = 88;
export const WORLD_W = CITY;
export const WORLD_H = CITY + BEACH_H;

export const DISTRICTS = [
  ['Marina Bay', 'Downtown', 'Harbor East'],
  ['Old Town', 'Midtown', 'The Docks'],
  ['Hillside', 'Southside', 'Beachfront'],
];

export const DISTRICT_TINTS = {
  'Marina Bay': '#7fb8a8',
  Downtown: '#8d9bb5',
  'Harbor East': '#6f9fb0',
  'Old Town': '#b09a7a',
  Midtown: '#9a8fb0',
  'The Docks': '#8a7f6a',
  Hillside: '#7fae7f',
  Southside: '#b08a8a',
  Beachfront: '#d8c08a',
};

export function roadCenter(i) {
  return i * PITCH + ROAD / 2;
}

export function districtAt(bx, by) {
  const dx = clamp(Math.floor(bx / 4), 0, 2);
  const dy = clamp(Math.floor(by / 4), 0, 2);
  return DISTRICTS[dy][dx];
}

// Fixed story addresses: [blockX, blockY, offsetX, offsetY, label]
export const PLACES = {
  garage: { bx: 2, by: 9, ox: 110, oy: 60, label: "Rico's Garage" },
  sals: { bx: 5, by: 2, ox: 110, oy: 110, label: "Sal's — The Anchor Bar" },
  bank: { bx: 6, by: 3, ox: 110, oy: 110, label: 'Harbor First Bank' },
  warehouse: { bx: 10, by: 5, ox: 110, oy: 110, label: 'Marlow Warehouse' },
  hospital: { bx: 5, by: 6, ox: 110, oy: 110, label: 'Sunset General' },
  policeHQ: { bx: 4, by: 3, ox: 110, oy: 110, label: 'HPD Central' },
  marina: { bx: 1, by: 0, ox: 110, oy: 110, label: 'Marina Viewpoint' },
  docks: { bx: 11, by: 6, ox: 110, oy: 110, label: 'Pier 9' },
  paynspray1: { bx: 3, by: 8, ox: 110, oy: 180, label: 'Pay-n-Spray' },
  paynspray2: { bx: 7, by: 4, ox: 110, oy: 180, label: 'Pay-n-Spray' },
};

export function placePos(city, key) {
  const p = PLACES[key];
  const x0 = p.bx * PITCH + ROAD;
  const y0 = p.by * PITCH + ROAD;
  return { x: x0 + p.ox, y: y0 + p.oy, label: p.label };
}

export function blockRect(bx, by) {
  return {
    x: bx * PITCH + ROAD,
    y: by * PITCH + ROAD,
    w: BLOCK,
    h: BLOCK,
  };
}

export function buildCity(seed = 'sunset-harbor-1337') {
  const rng = new RNG(seed);
  const buildings = [];
  const parks = [];
  const trees = [];
  const lamps = [];
  const water = []; // harbor basin rects
  const coins = [];
  const ramps = [];
  const buildingColors = [
    '#c98f6a', '#b07a5e', '#8fa3b8', '#a8b8c8', '#d8b48a', '#9a8a7a',
    '#7a8a9a', '#c8a0a0', '#a0b090', '#b8a888', '#e0c090', '#88a0b0',
  ];
  const shopColors = ['#d85a4a', '#4a90d8', '#e0a030', '#5ab87a', '#9a5ad8', '#d85a9a'];

  // Harbor basin: the north-east corner blocks are water with piers.
  const basin = { x: 10 * PITCH + ROAD, y: 0 * PITCH + ROAD, w: BLOCK * 2 + ROAD, h: BLOCK * 2 + ROAD };
  water.push(basin);

  for (let by = 0; by < GRID; by++) {
    for (let bx = 0; bx < GRID; bx++) {
      const r = blockRect(bx, by);
      const inBasin = bx >= 10 && by <= 1;
      const isPark = !inBasin && (bx + by * 3) % 7 === 3;
      const district = districtAt(bx, by);
      if (inBasin) {
        // Piers jutting into the basin.
        for (let p = 0; p < 3; p++) {
          buildings.push({
            x: r.x + 30 + p * 150, y: r.y + 40, w: 26, h: 140,
            color: '#6a5138', kind: 'pier', district, height: 0,
          });
        }
        continue;
      }
      if (isPark) {
        parks.push({ ...r, district });
        const n = rng.int(5, 9);
        for (let i = 0; i < n; i++) {
          trees.push({
            x: r.x + rng.float(20, BLOCK - 20),
            y: r.y + rng.float(20, BLOCK - 20),
            r: rng.float(9, 15),
            c: rng.pick(['#3f7a3a', '#4a8a3f', '#2f6a35', '#5a9a45']),
          });
        }
        continue;
      }
      // Buildings: 1-3 per block, kept off the sidewalk ring.
      const count = rng.int(1, 3);
      const slots = [
        { x: 14, y: 14, w: 92, h: 92 }, { x: 114, y: 14, w: 92, h: 92 },
        { x: 14, y: 114, w: 92, h: 92 }, { x: 114, y: 114, w: 92, h: 92 },
      ];
      for (let s = 0; s < count; s++) {
        const slot = slots[rng.int(0, 3)];
        if (buildings.some((b) => b.bx === bx && b.by === by && Math.abs(b.x - (r.x + slot.x)) < 4 && Math.abs(b.y - (r.y + slot.y)) < 4)) continue;
        const isShop = rng.chance(0.3);
        const tall = district === 'Downtown' && rng.chance(0.55);
        buildings.push({
          bx, by,
          x: r.x + slot.x, y: r.y + slot.y, w: slot.w, h: slot.h,
          color: isShop ? rng.pick(shopColors) : rng.pick(buildingColors),
          kind: isShop ? 'shop' : tall ? 'tower' : 'house',
          district,
          height: tall ? rng.int(14, 26) : rng.int(3, 9),
          roof: rng.pick(['#5a4a3a', '#3a3a3a', '#7a6a55', '#4a5a6a']),
        });
      }
      if (rng.chance(0.5)) {
        trees.push({
          x: r.x + rng.float(20, BLOCK - 20), y: r.y + rng.float(20, BLOCK - 20),
          r: rng.float(8, 13), c: rng.pick(['#3f7a3a', '#4a8a3f', '#2f6a35']),
        });
      }
    }
  }

  // Street lamps along every road, staggered.
  for (let i = 0; i <= GRID; i++) {
    for (let j = 0; j < GRID; j++) {
      if ((i + j) % 2 === 0) lamps.push({ x: roadCenter(i) - ROAD / 2 + 6, y: roadCenter(j) + ROAD / 2 - 6 });
      else lamps.push({ x: roadCenter(i) + ROAD / 2 - 6, y: roadCenter(j) - ROAD / 2 + 6 });
    }
  }

  // 40 harbor coins: on sidewalks, in parks and along the beach.
  for (let i = 0; i < 40; i++) {
    if (i < 30) {
      const bx = rng.int(0, GRID - 1);
      const by = rng.int(0, GRID - 1);
      const r = blockRect(bx, by);
      coins.push({ x: r.x + rng.float(8, BLOCK - 8), y: r.y + rng.float(8, BLOCK - 8), taken: false });
    } else {
      coins.push({ x: rng.float(60, CITY - 60), y: CITY + rng.float(12, BEACH_H - 12), taken: false });
    }
  }

  // 6 stunt ramps at road ends.
  const rampSpots = [
    { x: roadCenter(0), y: roadCenter(5), angle: 0 },
    { x: roadCenter(12), y: roadCenter(3), angle: Math.PI },
    { x: roadCenter(6), y: roadCenter(0), angle: Math.PI / 2 },
    { x: roadCenter(9), y: roadCenter(12), angle: -Math.PI / 2 },
    { x: roadCenter(2), y: roadCenter(12), angle: -Math.PI / 2 },
    { x: roadCenter(12), y: roadCenter(9), angle: Math.PI },
  ];
  for (const s of rampSpots) ramps.push({ ...s, used: false });

  // Traffic lights: intersections where (i+j) is a multiple of 3.
  const lights = [];
  for (let i = 1; i < GRID; i++) {
    for (let j = 1; j < GRID; j++) {
      if ((i + j) % 3 === 0) lights.push({ i, j, x: roadCenter(i), y: roadCenter(j), phase: (i * 7 + j * 13) % 8 });
    }
  }

  return { seed, buildings, parks, trees, lamps, water, coins, ramps, lights, basin };
}

// True when a point is on a road (or the beach strip).
export function isRoad(x, y) {
  if (y >= CITY && y <= WORLD_H) return true; // beach
  if (x < 0 || y < 0 || x > CITY || y > CITY) return false;
  const mx = x % PITCH;
  const my = y % PITCH;
  return mx < ROAD || my < ROAD;
}

// Circle vs building AABB collision. Returns the building hit, or null.
export function hitBuilding(city, x, y, r) {
  for (const b of city.buildings) {
    if (b.kind === 'pier') continue;
    if (x + r > b.x && x - r < b.x + b.w && y + r > b.y && y - r < b.y + b.h) return b;
  }
  return null;
}

// Push a circle out of buildings; returns true if a collision happened.
export function resolveBuildingCollision(city, obj, r) {
  let hit = false;
  for (const b of city.buildings) {
    if (b.kind === 'pier') continue;
    const cx = clamp(obj.x, b.x, b.x + b.w);
    const cy = clamp(obj.y, b.y, b.y + b.h);
    const dx = obj.x - cx;
    const dy = obj.y - cy;
    const d2 = dx * dx + dy * dy;
    if (d2 < r * r) {
      hit = true;
      if (d2 > 0.01) {
        const d = Math.sqrt(d2);
        obj.x = cx + (dx / d) * r;
        obj.y = cy + (dy / d) * r;
      } else {
        obj.y = b.y - r;
      }
    }
  }
  return hit;
}

export function inWater(city, x, y) {
  for (const w of city.water) {
    if (x > w.x && x < w.x + w.w && y > w.y && y < w.y + w.h) return true;
  }
  return false;
}

export function nearestRoadPoint(x, y) {
  const ix = Math.round((x - ROAD / 2) / PITCH);
  const iy = Math.round((y - ROAD / 2) / PITCH);
  const cx = clamp(ix, 0, GRID) * PITCH + ROAD / 2;
  const cy = clamp(iy, 0, GRID) * PITCH + ROAD / 2;
  // Snap to the closer of the two nearest road centrelines.
  const dxRoad = Math.abs(x - cx);
  const dyRoad = Math.abs(y - cy);
  if (dxRoad < dyRoad) return { x: cx, y, vertical: true };
  return { x, y: cy, vertical: false };
}
