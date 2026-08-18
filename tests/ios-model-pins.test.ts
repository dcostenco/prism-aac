/**
 * iOS model sideload pins must be immutable revisions — never moving refs.
 *
 * Found 2026-08-18: every GGUF download URL in ios-native pinned
 * `resolve/main` while carrying a hardcoded SHA-256. `main` moves; the hash
 * does not. The moment the upstream HF repo updates a file, one of two bad
 * things happens: downloads hash-mismatch and on-device model loading dies
 * (PrismAACApp path, which verifies), or users silently receive different
 * bytes than the ones the app was validated against (ContentView path,
 * which does not verify at all).
 *
 * This is a source contract test on purpose: the property IS a source
 * string invariant, and the Swift build has no cheap harness for it.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(__dirname, "..", "ios-native");

function swiftFiles(dir: string): string[] {
    const out: string[] = [];
    for (const name of readdirSync(dir)) {
        const p = join(dir, name);
        const st = statSync(p);
        if (st.isDirectory() && !name.startsWith(".") && name !== "_llama_cpp_local") {
            out.push(...swiftFiles(p));
        } else if (name.endsWith(".swift")) {
            out.push(p);
        }
    }
    return out;
}

describe("ios-native model pins", () => {
    const files = swiftFiles(ROOT);

    it("finds the Swift sources it claims to guard", () => {
        // Vacuity guard: if the tree moves, fail HERE, not by scanning nothing.
        expect(files.length).toBeGreaterThan(10);
    });

    it("no download URL uses a moving ref", () => {
        const offenders: string[] = [];
        for (const f of files) {
            const src = readFileSync(f, "utf8");
            if (/resolve\/(main|master)\//.test(src)) offenders.push(f.replace(ROOT, "ios-native"));
        }
        expect(offenders, `moving-ref pins in: ${offenders.join(", ")}`).toEqual([]);
    });

    it("every HuggingFace resolve URL pins a 40-hex commit", () => {
        const bad: string[] = [];
        for (const f of files) {
            const src = readFileSync(f, "utf8");
            for (const m of src.matchAll(/huggingface\.co\/[^"']*resolve\/([^/"']+)\//g)) {
                if (!/^[0-9a-f]{40}$/.test(m[1])) bad.push(`${f.replace(ROOT, "ios-native")}: resolve/${m[1]}`);
            }
        }
        expect(bad, bad.join(", ")).toEqual([]);
    });
});
