const fs = require("node:fs");
const path = require("node:path");

const file = path.join(__dirname, "../src/i18n/translations.ts");
const source = fs.readFileSync(file, "utf8");

function extractObjectBlock(exportName) {
  const marker = `export const ${exportName}`;
  const start = source.indexOf(marker);
  if (start < 0) throw new Error(`Could not find ${marker}`);
  const firstBrace = source.indexOf("{", start);
  if (firstBrace < 0) throw new Error(`Could not find object for ${exportName}`);

  let depth = 0;
  for (let i = firstBrace; i < source.length; i += 1) {
    const ch = source[i];
    if (ch === "{") depth += 1;
    if (ch === "}") {
      depth -= 1;
      if (depth === 0) return source.slice(firstBrace, i + 1);
    }
  }
  throw new Error(`Could not parse object for ${exportName}`);
}

function extractKeys(block) {
  const keys = new Set();
  const re = /"([^"]+)"\s*:/g;
  let match;
  while ((match = re.exec(block)) !== null) keys.add(match[1]);
  return [...keys].sort();
}

const englishKeys = extractKeys(extractObjectBlock("en"));
const amharicKeys = new Set(extractKeys(extractObjectBlock("am")));
const missing = englishKeys.filter((key) => !amharicKeys.has(key));

if (missing.length > 0) {
  console.error(`Missing Amharic translations (${missing.length}):`);
  for (const key of missing) console.error(`- ${key}`);
  process.exit(1);
}

console.log(`i18n coverage OK: ${englishKeys.length} keys.`);