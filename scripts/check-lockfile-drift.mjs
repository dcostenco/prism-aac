#!/usr/bin/env node
/**
 * check-lockfile-drift — package-lock.json must be what the canonical npm writes.
 * ─────────────────────────────────────────────────────────────────────────────
 * Regenerates the lock file with a PINNED npm and fails if the bytes move.
 *
 * WHY THIS EXISTS, SPECIFICALLY
 *
 * This repository's lock file was regenerated at some point on npm 11, which
 * prunes optional peer entries — here `@emnapi/core` and `@emnapi/runtime`,
 * peers of a wasm32-only binding no runner installs. npm 10 then refuses the
 * result outright:
 *
 *     npm error `npm ci` can only install packages when your package.json
 *     and package-lock.json ... are in sync.
 *     npm error Missing: @emnapi/core@1.11.1 from lock file
 *
 * npm 10 rejects the ABSENCE OF THE ENTRY, independently of whether it would
 * ever install that package on that platform.
 *
 * The consequence was not a red build but a silent one. With `npm ci`
 * unavailable, the deploy platform falls back to `npm install`, which
 * re-resolves transitive dependencies on every build — so two builds of the
 * same commit could install different trees, and a restored build cache made
 * the installed tree older still. Dependency versions stopped being a property
 * of the commit.
 *
 * WHY npm 10 IS CANONICAL AND NOT npm 11
 *
 * npm 10's output is the SUPERSET: it is accepted by npm 10 and npm 11 alike.
 * npm 11's output is a subset that npm 10 rejects, and every current Node
 * install ships npm 11 — so anyone who touches this lock file on a modern
 * machine reproduces the failure. Pinning to 10 costs nothing.
 *
 * WHY IT COMPARES SNAPSHOT-TO-RESULT, NOT TO GIT HEAD
 *
 * An earlier version of this check ran the regeneration and then asked
 * `git diff --exit-code package-lock.json`. That reports CLEAN on exactly the
 * failure it was written for: regenerating a drifted lock file REPAIRS it back
 * to the committed bytes, so the diff against HEAD is empty and the guard
 * passes while the tree it was handed was broken. The comparison has to be the
 * bytes as they arrived versus the bytes after regeneration.
 */
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

/**
 * The npm whose output is committed. Pinned to the patch: the point is
 * byte-reproducibility, and no one has shown that npm patch releases leave
 * lock file output alone.
 *
 * .github/workflows/lockfile-guard.yml runs this script and nothing else pins
 * npm, deliberately — the version lives HERE, once, and `npx npm@<this>` lets a
 * contributor on any local npm run the check without touching their install.
 */
const CANONICAL_NPM = "10.9.8";

/** Generous against a slow registry, tight against a dead one. */
const NPM_TIMEOUT_MS = 5 * 60 * 1000;

const PACKAGE_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const LOCKFILE = join(PACKAGE_ROOT, "package-lock.json");

const FIX_COMMAND = `npx --yes npm@${CANONICAL_NPM} install --package-lock-only`;

/**
 * Run the pinned npm. Anything other than a clean exit throws — a regeneration
 * that did not happen must never be read as "the lock file is fine".
 */
function runPinnedNpm(args, { capture = false } = {}) {
    const proc = spawnSync(
        "npx",
        ["--yes", `npm@${CANONICAL_NPM}`, ...args],
        {
            encoding: "utf8",
            cwd: PACKAGE_ROOT,
            maxBuffer: 64 * 1024 * 1024,
            // A registry that accepts the connection and never answers would
            // otherwise hold the step for the job's whole timeout. A cold fetch
            // of npm plus a full resolve measures ~10s.
            timeout: NPM_TIMEOUT_MS,
            killSignal: "SIGKILL",
            // On Windows `npx` is npx.cmd, and Node refuses to spawn a .cmd
            // without a shell (CVE-2024-27980). Every argument here is a bare
            // token, so the shell has nothing to misquote. CI runs this on
            // macOS; this is for `npm run check:lockfile` on a contributor's
            // Windows machine, and it is untested there.
            shell: process.platform === "win32",
        },
    );
    if (proc.error) {
        const { code } = proc.error;
        const what = `npx npm@${CANONICAL_NPM} ${args.join(" ")}`;
        throw new Error(
            code === "ETIMEDOUT"
                ? `${what} did not finish within ${NPM_TIMEOUT_MS / 1000}s and was killed.\n`
                  + "This check needs network access to fetch the pinned npm and resolve the tree."
                : code === "ENOENT"
                    ? `${what}: npx is not on PATH (${proc.error.message}).\n`
                      + "This check runs the pinned npm through npx; install Node with npm included."
                    : `could not run ${what}: ${proc.error.message}`,
        );
    }
    if (proc.status !== 0) {
        throw new Error(
            `npx npm@${CANONICAL_NPM} ${args.join(" ")} exited ${proc.status}.\n`
            + "Treating this as a FAILED check, not a clean one.\n"
            + `stderr: ${proc.stderr?.trim()}`,
        );
    }
    return capture ? proc.stdout.trim() : null;
}

/**
 * Prove the pin took effect. `npx` falls back to a PATH binary when resolution
 * goes wrong, and a silent fall-back to the local npm 11 would reproduce the
 * original incident inside the guard written to prevent it.
 */
function assertPinnedNpm() {
    const reported = runPinnedNpm(["--version"], { capture: true });
    if (reported !== CANONICAL_NPM) {
        throw new Error(
            `expected npm ${CANONICAL_NPM}, but npx ran npm ${reported}.\n`
            + "Refusing to compare lock files generated by an unknown npm.",
        );
    }
    return reported;
}

/**
 * Prove the comparison can fail. If `differs` were ever broken, every run
 * would report a clean lock file forever, and nothing else here would notice.
 */
function selfTest() {
    const a = Buffer.from('{"lockfileVersion":3}\n');
    const b = Buffer.from('{"lockfileVersion":3} \n');
    if (!differs(a, b)) {
        throw new Error(
            "check-lockfile-drift SELF-TEST FAILED — the byte comparison does not "
            + "detect a one-character difference, so this guard would pass on any input.",
        );
    }
    if (differs(a, Buffer.from(a))) {
        throw new Error(
            "check-lockfile-drift SELF-TEST FAILED — the byte comparison reports "
            + "identical buffers as different, so this guard would fail on any input.",
        );
    }
}

function differs(a, b) {
    return !a.equals(b);
}

/** Package-level delta, so the failure names what moved instead of "bytes changed". */
function describeDelta(beforeBuf, afterBuf) {
    let before;
    let after;
    try {
        before = JSON.parse(beforeBuf.toString("utf8")).packages ?? {};
        after = JSON.parse(afterBuf.toString("utf8")).packages ?? {};
    } catch {
        // A lock file that will not parse is itself the finding; the byte
        // comparison already failed, so report no detail rather than mask the
        // failure with a crash.
        return ["  (lock file is not valid JSON — cannot itemise the delta)"];
    }

    const lines = [];

    // The root entry ("") mirrors package.json's dependency maps, and it is the
    // one entry that can move with no node_modules entry moving at all:
    // promoting a transitive already in the tree to a direct dependency.
    // Without this block that case reports "formatting or metadata only".
    for (const field of ["dependencies", "devDependencies", "optionalDependencies", "peerDependencies"]) {
        const stale = before[""]?.[field] ?? {};
        const fresh = after[""]?.[field] ?? {};
        for (const name of Object.keys(stale)) {
            if (!(name in fresh)) lines.push(`  root     ${field}.${name}  in lock file, no longer in package.json`);
            else if (stale[name] !== fresh[name]) lines.push(`  root     ${field}.${name}  ${stale[name]} -> ${fresh[name]}`);
        }
        for (const name of Object.keys(fresh)) {
            if (!(name in stale)) lines.push(`  root     ${field}.${name}  in package.json (${fresh[name]}), not yet in lock file`);
        }
    }

    for (const key of Object.keys(before)) {
        if (key === "") continue;
        if (!(key in after)) lines.push(`  removed  ${key}@${before[key].version ?? "?"}`);
        else if (before[key].version !== after[key].version) {
            lines.push(`  changed  ${key}  ${before[key].version} -> ${after[key].version}`);
        }
    }
    for (const key of Object.keys(after)) {
        if (!(key in before)) lines.push(`  added    ${key}@${after[key].version ?? "?"}`);
    }
    return lines.length > 0 ? lines : ["  (no package-level delta — formatting or metadata only)"];
}

selfTest();

let before;
try {
    before = readFileSync(LOCKFILE);
} catch (error) {
    if (error.code !== "ENOENT") throw error;
    throw new Error(
        `package-lock.json is missing at ${LOCKFILE}. This package commits its lock file — `
        + `generate one with:\n\n    ${FIX_COMMAND}\n`,
    );
}
const npmVersion = assertPinnedNpm();

/**
 * Hand the tree back exactly as it arrived. The next CI step runs `npm ci`
 * against this file, and a check that silently repairs its own subject turns
 * a red build green without anyone committing the fix.
 *
 * Restores CONTENT, not mtime: npm rewrites package-lock.json during
 * `--package-lock-only` even when the result is byte-identical, so the
 * timestamp has already moved by the time this runs. Nothing keys off it.
 */
function restore() {
    let current = null;
    try {
        current = readFileSync(LOCKFILE);
    } catch (error) {
        // The file is gone — npm was killed before its atomic rename landed, or
        // never wrote at all. Throwing here from inside `finally` would replace
        // the real error and leave the tree with no lock file; write it back.
        if (error.code !== "ENOENT") throw error;
    }
    if (current === null || differs(current, before)) writeFileSync(LOCKFILE, before);
}

/**
 * `finally` unwinds exceptions, not signals. Without these, Ctrl-C during the
 * regeneration leaves the developer holding a lock file this script rewrote —
 * which is the one outcome it promises never to produce.
 */
const onSignal = (sig) => {
    try {
        restore();
    } finally {
        process.exit(sig === "SIGINT" ? 130 : 143);
    }
};
process.on("SIGINT", () => onSignal("SIGINT"));
process.on("SIGTERM", () => onSignal("SIGTERM"));

let after;
try {
    runPinnedNpm(["install", "--package-lock-only", "--ignore-scripts", "--no-audit", "--no-fund"]);
    after = readFileSync(LOCKFILE);
} finally {
    restore();
}

if (differs(before, after)) {
    console.error(
        `BLOCKED: package-lock.json is not what npm ${CANONICAL_NPM} generates.\n`,
    );
    for (const line of describeDelta(before, after)) console.error(line);
    console.error(
        `\nRegenerate it with the canonical npm, and commit the result:\n`
        + `\n    ${FIX_COMMAND}\n`
        + `\nDo NOT regenerate with a newer npm. npm 11 prunes optional peer entries`
        + `\nthat npm 10 requires, and npm 10 is what actions/setup-node bundles for`
        + `\nthe Node 22 runner — the lock file it writes is the one every supported`
        + `\nnpm accepts.`,
    );
    process.exit(1);
}

console.log(
    `check-lockfile-drift: package-lock.json reproduces byte-for-byte under npm ${npmVersion}.`,
);
