// Duskwing Post — hand-in program (Node 22, standard library only).
//
// The game itself is the static site under game/ (open game/index.html in a
// desktop browser and it plays offline). This program performs the hand-in:
// it mirrors game/ and screenshots/ into the output directory and writes
// dossier.json there with buildDossier from the vendored make.fun library,
// byte for byte the way the grader rebuilds it.
//
// In the grader the output directory is /output; anywhere else set
// MAKEFUN_OUTPUT_DIR to stand in for it:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// Mirror the two payload directories exactly as they sit in the repository.
mkdirSync(outputDir, { recursive: true });
cpSync(join(repoRoot, 'game'), join(outputDir, 'game'), { recursive: true });
mkdirSync(join(outputDir, 'screenshots'), { recursive: true });
if (existsSync(join(repoRoot, 'screenshots'))) {
  cpSync(join(repoRoot, 'screenshots'), join(outputDir, 'screenshots'), { recursive: true });
}

// The caps below are the gate's own limits: at most 4 screenshots of at most
// 256 KiB each, at most 993 entries and 48 MiB under game/, no game/ path over
// 1,000 bytes, and the dossier's source text capped at 160 KiB.
const dossierText = buildDossier(outputDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
});
writeFileSync(join(outputDir, 'dossier.json'), dossierText);
