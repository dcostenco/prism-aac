#!/usr/bin/env python3
"""
Auto-generate translated Prism AAC READMEs using Gemini AI.
Triggered by GitHub Actions on README.md changes.

Requires: GEMINI_API_KEY env var (Gemini 2.5 Flash).
"""
import os
import sys
import json
import pathlib
import urllib.request
import urllib.error
import time

REPO_ROOT = pathlib.Path(__file__).resolve().parent.parent
I18N_DIR = REPO_ROOT / "docs" / "i18n"
README_PATH = REPO_ROOT / "README.md"

LANGS = {
    "es": "Spanish (Español)",
    "fr": "French (Français)",
    "pt": "Portuguese (Português)",
    "ro": "Romanian (Română)",
    "uk": "Ukrainian (Українська)",
    "ru": "Russian (Русский)",
    "de": "German (Deutsch)",
    "ja": "Japanese (日本語)",
    "ko": "Korean (한국어)",
    "zh": "Chinese Simplified (中文)",
    "ar": "Arabic (العربية)",
}

LANG_NAMES = {
    "es": "Español", "fr": "Français", "pt": "Português", "ro": "Română",
    "uk": "Українська", "ru": "Русский", "de": "Deutsch", "ja": "日本語",
    "ko": "한국어", "zh": "中文", "ar": "العربية",
}

GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")
# thinkingLevel "minimal": 3.6 rejects thinkingBudget 0, and default thinking
# burns thought tokens against maxOutputTokens on every translation batch.
GEMINI_MODEL = "gemini-3.6-flash"
# Key goes in the x-goog-api-key header, NOT the URL — ?key= leaks the
# secret into any request/proxy log (same bug class fixed portal-wide).
GEMINI_URL = f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent"


def call_gemini(prompt: str, max_retries: int = 3) -> str:
    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {
            "temperature": 0.1,
            "maxOutputTokens": 65536,
            "thinkingConfig": {"thinkingLevel": "minimal"},
        },
    }
    data = json.dumps(payload).encode("utf-8")

    for attempt in range(max_retries):
        try:
            req = urllib.request.Request(
                GEMINI_URL,
                data=data,
                headers={"Content-Type": "application/json", "x-goog-api-key": GEMINI_API_KEY},
                method="POST",
            )
            with urllib.request.urlopen(req, timeout=300) as resp:
                result = json.loads(resp.read().decode("utf-8"))
                text = result["candidates"][0]["content"]["parts"][0]["text"]
                # Strip markdown fences if Gemini wraps output
                if text.startswith("```"):
                    first_nl = text.index("\n")
                    last_fence = text.rfind("```")
                    text = text[first_nl + 1:last_fence].strip()
                return text
        except (urllib.error.HTTPError, urllib.error.URLError, KeyError) as e:
            print(f"    Attempt {attempt + 1} failed: {e}")
            if attempt < max_retries - 1:
                time.sleep(2 ** attempt)
            else:
                raise


def build_lang_selector(current_code: str) -> str:
    parts = ["[English](../../README.md)"]
    for code, name in LANG_NAMES.items():
        if code == current_code:
            parts.append(f"**{name}**")
        else:
            parts.append(f"[{name}](README_{code}.md)")
    return " · ".join(parts)


def translate_readme(source: str, lang_code: str, lang_name: str) -> str:
    prompt = f"""Translate the following GitHub README.md from English to {lang_name}.

RULES:
1. Translate ALL text — headings, descriptions, table cells, alt text, button labels. No English left except:
   - Brand names: "Prism AAC", "Synalux", "ARASAAC", "Inworld", "Apple", "Google", "MediaPipe"
   - Technical terms: API, TTS, WASM, SSE, CORS, JWT, PWA, HIPAA, SDK, CLI
   - Code blocks, URLs, file paths, command-line examples — keep exactly as-is
   - Badge URLs, image markdown, `<img>` tags, `<p>` tags — keep exactly as-is
2. Preserve ALL markdown formatting: headers, tables, code blocks, links, images, HTML tags
3. Keep ALL images and screenshots — every `![...](...) ` and `<img src="...">` must appear in the translation at the same position
4. Replace the language selector line (🌐 **Translations:**...) with this exact line:
   🌐 {build_lang_selector(lang_code)}
5. Add this header as the very first line:
   <!-- Auto-generated from README.md by scripts/generate_i18n.py — do not edit manually -->
6. Keep the EXACT same document structure, section order, and section count
7. For RTL languages (Arabic), add `dir="rtl"` to the top-level heading if needed
8. Translate naturally — not word-for-word. Use the standard terminology for AAC/disability/accessibility in {lang_name}
9. Tables: translate header cells and content cells, keep | alignment
10. Image paths are relative to the repo root — adjust for the docs/i18n/ location (prefix with ../../)

Output ONLY the translated markdown. No explanation, no wrapping.

SOURCE:
{source}"""

    return call_gemini(prompt)


def main():
    if not GEMINI_API_KEY:
        print("ERROR: GEMINI_API_KEY not set. Set it as env var or GitHub secret.")
        sys.exit(1)

    source = README_PATH.read_text(encoding="utf-8")
    I18N_DIR.mkdir(parents=True, exist_ok=True)

    print(f"Translating README.md ({len(source)} chars) into {len(LANGS)} languages...")

    for code, lang_name in LANGS.items():
        out_path = I18N_DIR / f"README_{code}.md"
        if out_path.exists():
            try:
                existing_lines = len(out_path.read_text(encoding="utf-8").splitlines())
                if existing_lines > 500:
                    print(f"  [{code}] {lang_name}... SKIPPED (already translated, {existing_lines} lines)")
                    continue
            except Exception:
                pass
        print(f"  [{code}] {lang_name}...", end=" ", flush=True)
        try:
            translated = translate_readme(source, code, lang_name)
            out_path.write_text(translated, encoding="utf-8")
            print(f"OK ({len(translated)} chars)")
        except Exception as e:
            print(f"FAILED: {e}")
            # Keep existing file if translation fails
            continue

    print("Done.")


if __name__ == "__main__":
    main()
