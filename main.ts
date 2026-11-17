// VICE HARBOR — the hand-in program.
//
// The game itself is the static site under game/ (open game/index.html in a
// desktop browser and Port Azura loads, no build step, no network). This
// little Node 22 program is only the courier: it carries game/ and
// screenshots/ from this repository into the output folder and writes the
// dossier the make.fun judge reads, using the platform's own vendored
// library so the bytes match the scorer's rebuild exactly.
//
// Run it the way the grader does, or locally with an override:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// The gate's own limits, passed through so this program refuses anything
// the scorer would refuse: 4 screenshots of at most 256 KiB, 993 game
// entries, 48 MiB of game, no game path over 1,000 bytes. Only the text
// cap shapes the dossier bytes; the rest are guard rails.
const GATE_CAPS = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
};

function stageFolder(name) {
  const from = join(repoRoot, name);
  const to = join(outputDir, name);
  mkdirSync(to, { recursive: true });
  if (existsSync(from)) {
    cpSync(from, to, { recursive: true });
    console.log(`vice-harbor hand-in: staged ${name}/`);
  } else {
    console.log(`vice-harbor hand-in: no ${name}/ in the repository, staged an empty one`);
  }
}

mkdirSync(outputDir, { recursive: true });
stageFolder('game');
stageFolder('screenshots');

const dossier = buildDossier(outputDir, GATE_CAPS);
writeFileSync(join(outputDir, 'dossier.json'), dossier);
console.log(`vice-harbor hand-in: dossier.json written (${dossier.length} bytes)`);
