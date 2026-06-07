import { askAI } from '../services/aiService';

async function run() {
  console.log("Testing Math Tutor prompt...");
  
  // We need to bypass the native bridge and mock window since it's node environment
  (global as any).window = {
    location: { protocol: 'http:' },
    prismNativeBridge: undefined
  };

  const tutorContext = 'Math Tutor - 1st Grade. History region: US-TX.';
  
  const prompt = `The child wrote this math expression: "1". They need help understanding what to do next. Give a gentle hint — don't solve it, just guide them to the next step. Use simple words. Be encouraging. Max 2 sentences.

Respond in English. Use natural English phrasing, not a translated-from-English feel.`;

  try {
    const response = await askAI(prompt, tutorContext, undefined, 'en');
    console.log("\\n=== FINAL RESPONSE ===");
    console.log(response.text);
    
    if (response.text.trim() === 'I can help with that!') {
      console.error("❌ FAILED: Model returned useless acknowledgment.");
      process.exit(1);
    } else if (response.text.length < 30) {
      console.error("❌ FAILED: Response is too short to be a valid hint.");
      process.exit(1);
    } else {
      console.log("✅ PASSED: Model returned a substantial response.");
    }
  } catch (err) {
    console.error("Error:", err);
  }
}

run();
