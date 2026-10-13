// Read-only local experiment. Never embeds or uploads a private camera report.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import ts from 'typescript';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MAP_DECLARATIONS = new Set(['DEFAULT_CALIBRATION', 'POSE_CALIBRATION_MIN_RANGE', 'mapPoseToScreen']);
const MAX_PAIR_MS = 150;
const nodeRequire = createRequire(import.meta.url);
const loaded = new Map();
// Production modules import each other; resolve those through this same
// transpiling loader (once each) and leave packages to Node.
function loadSource(relative, selectMapper = false) {
  const key = selectMapper ? `${relative}#mapper` : relative;
  if (loaded.has(key)) return loaded.get(key).exports;
  let source = fs.readFileSync(path.join(ROOT, relative), 'utf8');
  if (selectMapper) {
    const parsed = ts.createSourceFile(relative, source, ts.ScriptTarget.Latest, true);
    const declarations = parsed.statements.filter(node => ts.isFunctionDeclaration(node)
      ? MAP_DECLARATIONS.has(node.name?.text) : ts.isVariableStatement(node) && node.declarationList.declarations.some(d => MAP_DECLARATIONS.has(d.name.getText(parsed))));
    source = ts.createPrinter().printFile(ts.factory.updateSourceFile(parsed, declarations));
  }
  const module = { exports: {} };
  loaded.set(key, module);
  const requireDependency = specifier => specifier.startsWith('.') ? loadSource(path.join(path.dirname(relative), `${specifier}.ts`))
    : specifier.startsWith('@/') ? loadSource(`${specifier.slice(2)}.ts`) : nodeRequire(specifier);
  new Function('module', 'exports', 'require', ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText)(module, module.exports, requireDependency);
  return module.exports;
}
const input = process.argv[2];
if (!input) throw new Error('Pass a private local tracking report path. No report is written or uploaded.');
const bytes = fs.readFileSync(input), report = JSON.parse(bytes);
if (report.schemaVersion !== 1 || !Array.isArray(report.frames) || !report.frames.length || report.frames.some(f => f.pipeline !== 'pose' || !['right_wrist', 'left_wrist'].includes(f.target))) throw new Error('Expected a nonempty wrist-only diagnostic report');
const { WristMotion, limitWristCursorStep } = loadSource('services/wristMotion.ts');
const { ConfidenceAwareOneEuro } = loadSource('services/oneEuroFilter.ts');
const { mapPoseToScreen } = loadSource('services/bodyPoseService.ts', true);
const gate = new WristMotion(), x = new ConfidenceAwareOneEuro(), y = new ConfidenceAwareOneEuro();
let initialized = false, cursor = null, previousTime = null, previousFrame = null, rejected = 0, paused = 0;
let baselineMax = 0, candidateMax = 0;
for (const frame of report.frames) {
  const time = frame.elapsedMs;
  if (previousTime !== null && report.states?.some(s => s.pipeline === 'pose' && s.status !== 'tracking' && s.elapsedMs > previousTime && s.elapsedMs <= time)) gate.interrupt();
  const motion = gate.update({ x: frame.inputNorm[0], y: frame.inputNorm[1] }, time, Math.max(...frame.videoSize));
  const calibration = { leftX: frame.calibration[0], rightX: frame.calibration[1], topY: frame.calibration[2], bottomY: frame.calibration[3] };
  const mapped = mapPoseToScreen(motion.point.x, motion.point.y, calibration, frame.sensitivity, ...frame.screenSize);
  if (!initialized) { x.snapTo(mapped.x); y.snapTo(mapped.y); cursor = { x: mapped.x, y: mapped.y }; initialized = true; }
  let next = cursor;
  if (motion.rejected) rejected++;
  else {
    x.setNoiseFloor(motion.noise); y.setNoiseFloor(motion.noise);
    next = limitWristCursorStep(cursor, { x: x.update(mapped.x, frame.filterConfidence, time), y: y.update(mapped.y, frame.filterConfidence, time) },
      previousTime === null ? 1000 / 15 : time - previousTime, ...frame.screenSize);
  }
  if (motion.paused) paused++;
  if (previousTime !== null && time - previousTime < MAX_PAIR_MS && JSON.stringify(frame.calibration) === JSON.stringify(previousFrame.calibration)) {
    baselineMax = Math.max(baselineMax, Math.hypot(frame.filtered[0] - previousFrame.filtered[0], frame.filtered[1] - previousFrame.filtered[1]));
    candidateMax = Math.max(candidateMax, Math.hypot(next.x - cursor.x, next.y - cursor.y));
  }
  cursor = next; previousTime = time; previousFrame = frame;
}
console.log(JSON.stringify({ sourceReportSHA256: createHash('sha256').update(bytes).digest('hex'), frames: report.frames.length,
  rejected, paused, recordedMaxCursorStepPx: baselineMax, replayMaxCursorStepPx: candidateMax,
  limitation: 'Unlabelled recorded trajectory replay, not live head/wrist recognition, user-intent or physical-camera acceptance.' }, null, 2));
