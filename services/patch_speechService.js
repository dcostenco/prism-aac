const fs = require('fs');
const path = '/Users/admin/prism-aac/services/speechService.ts';
let code = fs.readFileSync(path, 'utf8');

// Update speakLocal signature
code = code.replace(
  /function speakLocal\(text: string, rate: number, volume: number, lang: string\): void \{/,
  "function speakLocal(text: string, rate: number, volume: number, lang: string): Promise<void> {\n  return new Promise<void>((resolve) => {"
);

// Update speakLocal returns
code = code.replace(
  /  if \(!text\.trim\(\)\) return;\n  if \(!isSpeechSupported\(\)\) \{\n    console\.warn\('\[PrismAAC\] Speech synthesis not available on this browser'\);\n    return;\n  \}/,
  "  if (!text.trim()) return resolve();\n  if (!isSpeechSupported()) {\n    console.warn('[PrismAAC] Speech synthesis not available on this browser');\n    return resolve();\n  }"
);

code = code.replace(
  /  u\.onend = \(\) => \{([\s\S]*?)\};/g,
  "  u.onend = () => {$1\n    resolve();\n  };"
);

code = code.replace(
  /  u\.onerror = \(ev\) => \{([\s\S]*?)\};/g,
  "  u.onerror = (ev) => {$1\n    resolve();\n  };"
);

// Close the promise in speakLocal
code = code.replace(/  window\.speechSynthesis\.speak\(u\);\n\}/, "  window.speechSynthesis.speak(u);\n  });\n}");

// Update speak() Azure path
code = code.replace(
  /    const success = await speakAzure\(text, lang, effectiveTone, effectiveRate, volume, token \|\| '', voiceId, interrupt\);\n    if \(success\) \{/,
  "    const result = await speakAzure(text, lang, effectiveTone, effectiveRate, volume, token || '', voiceId, interrupt);\n    if (result && result.success) {"
);

code = code.replace(
  /      emitTtsHealthEvent\(\{([\s\S]*?)\}\);\n      return;\n    \}/,
  "      emitTtsHealthEvent({$1});\n      if (result.onEnded) await result.onEnded;\n      return;\n    }"
);

// Update speak() Web Speech path
code = code.replace(
  /    speakLocal\(text, effectiveRate, volume, lang\);\n    return;\n  \}/,
  "    await speakLocal(text, effectiveRate, volume, lang);\n    return;\n  }"
);

// Update speakWord to not await speakLocal since it returns Promise now
code = code.replace(
  /  speakLocal\(word, rate, volume, actualLang\);/,
  "  void speakLocal(word, rate, volume, actualLang);"
);

fs.writeFileSync(path, code);
console.log("speechService.ts patched");
