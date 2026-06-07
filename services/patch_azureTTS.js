const fs = require('fs');
const path = '/Users/admin/prism-aac/services/azureTTS.ts';
let code = fs.readFileSync(path, 'utf8');

// Update decodeAndPlay signature
code = code.replace(
  /async function decodeAndPlay\(audioBytes: ArrayBuffer, volume: number, label: string, interrupt = false, playbackRate = 1\.0\): Promise<boolean> \{/,
  "async function decodeAndPlay(audioBytes: ArrayBuffer, volume: number, label: string, interrupt = false, playbackRate = 1.0): Promise<{ success: boolean, onEnded?: Promise<void> }> {"
);

// Update decodeAndPlay start
code = code.replace(
  /  const source = ctx\.createBufferSource\(\);/,
  "  let resolveEnded: () => void;\n  const onEnded = new Promise<void>(res => resolveEnded = res);\n  const source = ctx.createBufferSource();"
);

// Update decodeAndPlay onended
code = code.replace(
  /    try \{ gain\.disconnect\(\); \} catch \{ \/\* \*\/ \}\n  \};/,
  "    try { gain.disconnect(); } catch { /* */ }\n    resolveEnded();\n  };"
);

// Update decodeAndPlay return false
code = code.replace(/    return false;\n  \}\n  return true;\n\}/, "    return { success: false };\n  }\n  return { success: true, onEnded };\n}");
code = code.replace(/    return false;\n/g, "    return { success: false };\n");
code = code.replace(/    return true;\n/g, "    return { success: true };\n");

// Update speakGemini
code = code.replace(
  /async function speakGemini\([\s\S]*?\): Promise<boolean> \{/,
  "async function speakGemini(text: string, volume: number, controller: AbortController, lang?: string, interrupt = false): Promise<{ success: boolean, onEnded?: Promise<void> }> {"
);

// Update speakAzure
code = code.replace(
  /export async function speakAzure\(\/\* DEPLOY_SENTINEL_1778243738_28516 \*\/\n  text: string,\n  lang: string,\n  tone: ToneStyle,\n  rate: number,\n  volume: number,\n  authToken: string,\n  voiceId\?: string,\n  \/\*\*[\s\S]*?\*\/\n  interrupt = false,\n\): Promise<boolean> \{/,
  "export async function speakAzure(/* DEPLOY_SENTINEL_1778243738_28516 */\n  text: string,\n  lang: string,\n  tone: ToneStyle,\n  rate: number,\n  volume: number,\n  authToken: string,\n  voiceId?: string,\n  interrupt = false,\n): Promise<{ success: boolean, onEnded?: Promise<void> }> {"
);

fs.writeFileSync(path, code);
console.log("azureTTS.ts patched");
