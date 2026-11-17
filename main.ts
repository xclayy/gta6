// main.ts — the entry program for "Sunset Harbor — Streets of Gold"
// (make.fun bounty gta6-01). It runs on Node 22 with the standard library
// only: it copies this repository's game/ and screenshots/ into the output
// directory and writes /output/dossier.json with buildDossier from the
// vendored make.fun library, so the scorer and the judge see exactly the
// game that was built. Outside the grader, MAKEFUN_OUTPUT_DIR stands in
// for /output:
//
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
//
// The build is deterministic: the same repository always writes the same
// bytes, so the grader's two runs agree byte for byte.

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) {
  cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });
}

// The caps mirror the scorer's own limits (see the kit's RULES.txt): at most
// 4 screenshots of 256 KiB, at most 993 game files totalling 48 MiB, and a
// dossier text cap of 160 KiB. An entry that would break them is refused
// here instead of at the gate.
const dossier = buildDossier(out, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
});
writeFileSync(join(out, 'dossier.json'), dossier);
