const fs = require('fs');
const path = '/Users/admin/prism-aac/components/AIChatPanel.tsx';
let code = fs.readFileSync(path, 'utf8');

// We are going to replace drainQueue logic
code = code.replace(
  /      const drainQueue = \(\) => \{\n        if \(speaking \|\| sentenceQueue\.length === 0 \|\| !se\) return;\n        speaking = true;\n        const sentence = sentenceQueue\.shift\(\)!;\n        const dur = Math\.max\(800, sentence\.length \* 65\);\n        const timer = setTimeout\(\(\) => \{ if \(!cancelled\) \{ speaking = false; drainQueue\(\); \} \}, dur\);\n        queueTimers\.current\.push\(timer\);\n        if \(!cancelled\) aacSpeak\(sentence, sr, sv, undefined, true\);\n      \};/,
  `      const drainQueue = async () => {
        if (speaking || sentenceQueue.length === 0 || !se) return;
        speaking = true;
        const sentence = sentenceQueue.shift()!;
        if (!cancelled) {
          await aacSpeak(sentence, sr, sv, undefined, true);
        }
        if (!cancelled) {
          speaking = false;
          drainQueue();
        }
      };`
);

// We need to change the function declaration from const drainQueue = () => { to const drainQueue = async () => {
// The above regex handles it.

fs.writeFileSync(path, code);
console.log("AIChatPanel.tsx patched");
