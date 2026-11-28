import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";

const files = execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard"], {
  encoding: "utf8",
})
  .split("\n")
  .filter(Boolean)
  .filter((file) => !file.endsWith("pnpm-lock.yaml"));

const patterns = [
  { name: "Telegram bot token", regex: /\b\d{8,10}:[A-Za-z0-9_-]{35}\b/g },
  { name: "OpenAI-style key", regex: /\bsk-[A-Za-z0-9_-]{20,}\b/g },
  { name: "GitHub token", regex: /\bgh[pousr]_[A-Za-z0-9]{30,}\b/g },
  { name: "Private key", regex: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g },
];

const findings = [];
for (const file of files) {
  const content = await readFile(file, "utf8").catch(() => "");
  for (const pattern of patterns) {
    if (pattern.regex.test(content)) findings.push(`${file}: ${pattern.name}`);
    pattern.regex.lastIndex = 0;
  }
}

if (findings.length > 0) throw new Error(`Potential secrets detected:\n${findings.join("\n")}`);
console.log(`Scanned ${files.length} tracked files; no known secret patterns detected.`);
