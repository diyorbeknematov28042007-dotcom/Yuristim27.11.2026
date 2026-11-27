import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const migrationsDir = path.resolve(import.meta.dirname, "../migrations");
const entries = (await readdir(migrationsDir)).filter((file) => file.endsWith(".sql")).sort();

if (entries.length === 0) {
  throw new Error("No SQL migrations found");
}

for (const [index, file] of entries.entries()) {
  const expectedPrefix = String(index + 1).padStart(4, "0");
  if (!file.startsWith(`${expectedPrefix}_`)) {
    throw new Error(`Migration ${file} must start with ${expectedPrefix}_`);
  }

  const sql = await readFile(path.join(migrationsDir, file), "utf8");
  if (!sql.trim().endsWith(";")) {
    throw new Error(`Migration ${file} must end with a semicolon`);
  }
  if (/\b(DROP\s+(DATABASE|TABLE)|ATTACH\s+DATABASE)\b/i.test(sql)) {
    throw new Error(`Migration ${file} contains a destructive or unsupported statement`);
  }
}

console.log(`Validated ${entries.length} ordered migration files.`);
