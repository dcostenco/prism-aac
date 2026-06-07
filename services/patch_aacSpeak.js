const fs = require('fs');
const path = '/Users/admin/prism-aac/services/aacSpeak.ts';
let code = fs.readFileSync(path, 'utf8');

// Update aacSpeak signature
code = code.replace(
  /export function aacSpeak\(text: string, rate: number, volume: number, tone\?: ToneStyle, interrupt = false, spokenLang\?: SupportedLanguage\): void \{/,
  "export async function aacSpeak(text: string, rate: number, volume: number, tone?: ToneStyle, interrupt = false, spokenLang?: SupportedLanguage): Promise<void> {"
);

code = code.replace(
  /    speak\(toSpeak, effectiveRate, volume, ttsCode, effectiveTone, interrupt\);/,
  "    await speak(toSpeak, effectiveRate, volume, ttsCode, effectiveTone, interrupt);"
);

code = code.replace(
  /    try \{ speak\(text, rate, volume, getTTSCode\(fallbackLang as SupportedLanguage\)\); \} catch \{ \/\* \*\/ \}/,
  "    try { await speak(text, rate, volume, getTTSCode(fallbackLang as SupportedLanguage)); } catch { /* */ }"
);

fs.writeFileSync(path, code);
console.log("aacSpeak.ts patched");
