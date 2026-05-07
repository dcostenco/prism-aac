#!/usr/bin/env node
/**
 * State-coverage verifier — closes the bug class that bit prism-aac on
 * 2026-05-07 (the agent claimed a UI fix shipped after screenshotting
 * one of two empty-state branches; the user was always in the other).
 *
 * Reads /tmp/<repo>-visual/report.json (produced by visual-check.mjs),
 * asserts:
 *
 *   1. EVERY required state branch was measured.
 *   2. The numeric `panel.h` cap holds for the WORST-case branch, not
 *      a cherry-picked best case.
 *   3. Each measured branch self-reports its branch label so we know
 *      which conditional fired (vs. silently rendering the wrong one).
 *
 * Exit codes:
 *   0  all required branches present and under cap
 *   1  state coverage gap OR cap exceeded
 *   2  malformed report
 *
 * Configure via env:
 *   REPORT_PATH         default: /tmp/prism-aac-visual/report.json
 *   REQUIRED_PASSES     comma-separated, e.g. "ai-unconfigured,ai-configured-empty,aac-empty"
 *   PANEL_HEIGHT_CAP    default: 180   (px; max allowed across ALL branches)
 *   ALLOW_BRANCH_UNKNOWN default: 0    (1 = don't fail when branch detection couldn't classify)
 */
import fs from 'node:fs';

const REPORT = process.env.REPORT_PATH || '/tmp/prism-aac-visual/report.json';
const REQUIRED = (process.env.REQUIRED_PASSES || 'ai-unconfigured,ai-configured-empty,aac-empty').split(',').map(s => s.trim()).filter(Boolean);
const CAP = parseInt(process.env.PANEL_HEIGHT_CAP || '180', 10);
const ALLOW_UNKNOWN = process.env.ALLOW_BRANCH_UNKNOWN === '1';

if (!fs.existsSync(REPORT)) {
  console.error(`[verify-state-coverage] FAIL: report missing at ${REPORT}.`);
  console.error('Run scripts/visual-check.mjs first.');
  process.exit(2);
}

let report;
try {
  report = JSON.parse(fs.readFileSync(REPORT, 'utf8'));
} catch (e) {
  console.error(`[verify-state-coverage] FAIL: report not valid JSON: ${e.message}`);
  process.exit(2);
}

if (!Array.isArray(report)) {
  console.error('[verify-state-coverage] FAIL: report root must be an array.');
  process.exit(2);
}

let bad = 0;

// 1. Coverage check — every required pass must be present.
const seenPasses = new Set(report.map(r => r.pass));
for (const required of REQUIRED) {
  if (!seenPasses.has(required)) {
    console.error(`[verify-state-coverage] FAIL: required pass "${required}" not measured.`);
    bad++;
  }
}

// 2. Cap check — every measured panel must be under the cap.
const tooTall = report.filter(r => r.panel?.h && r.panel.h > CAP);
for (const r of tooTall) {
  console.error(`[verify-state-coverage] FAIL: pass="${r.pass}" branch="${r.branch}" panel.h=${r.panel.h}px > cap=${CAP}px`);
  bad++;
}

// 3. Branch self-report — if a pass classifies as "unknown", we don't
//    actually know which conditional rendered. That's a smell — block
//    unless explicitly allowed via ALLOW_BRANCH_UNKNOWN.
if (!ALLOW_UNKNOWN) {
  const unknowns = report.filter(r => r.branch === 'unknown');
  for (const r of unknowns) {
    console.error(`[verify-state-coverage] FAIL: pass="${r.pass}" branch="unknown" — branch detection failed; can't verify which UI fired. Set ALLOW_BRANCH_UNKNOWN=1 to suppress.`);
    bad++;
  }
}

// 4. Report card.
console.log('[verify-state-coverage] coverage report:');
for (const r of report) {
  const h = r.panel?.h ?? '?';
  const flag = r.panel?.h > CAP ? '🔴' : '✅';
  console.log(`  ${flag}  ${r.pass.padEnd(28)}  branch=${(r.branch || '?').padEnd(20)}  panel.h=${h}px`);
}

if (bad > 0) {
  console.error(`[verify-state-coverage] FAIL: ${bad} violation(s).`);
  process.exit(1);
}
console.log(`[verify-state-coverage] OK: ${REQUIRED.length} required passes present, all ≤ ${CAP}px.`);
process.exit(0);
