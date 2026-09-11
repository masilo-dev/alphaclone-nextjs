import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const p = path.join(__dirname, "..", "src", "lib", "businessOsGuidance.ts");
let s = fs.readFileSync(p, "utf8");

if (!s.includes("TASK_HINT_MINDSET")) {
  s = s.replace(
    "export type BusinessOsGuidance",
    `const TASK_HINT_MINDSET = 'Choose one clear next step before you leave this screen.';
const TASK_HINT_OUTCOME = 'Update dates, value, or owners so others can act without guessing.';

export type BusinessOsGuidance`,
  );
}

s = s.replace(/mindset:\s*\n\s*'[^']*'/g, "mindset: TASK_HINT_MINDSET");
s = s.replace(/outcome:\s*\n\s*'[^']*'/g, "outcome: TASK_HINT_OUTCOME");
s = s.replace(/outcome:\s*'[^']*'/g, "outcome: TASK_HINT_OUTCOME");

fs.writeFileSync(p, s);
console.log("businessOsGuidance compacted");
