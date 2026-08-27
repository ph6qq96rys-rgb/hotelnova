const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const sourceRoot = path.join(root, "src");
const extensions = new Set([".ts", ".tsx", ".js", ".jsx", ".css", ".html", ".md"]);
const mojibakePattern = /[ÃÂÆƒ¢€Å]|â(?:€|„|œ|¢|Â|')|�/;
const offenders = [];

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath);
      continue;
    }
    if (!extensions.has(path.extname(entry.name))) continue;

    const lines = fs.readFileSync(fullPath, "utf8").split(/\r?\n/);
    lines.forEach((line, index) => {
      if (mojibakePattern.test(line)) {
        offenders.push(`${path.relative(root, fullPath)}:${index + 1}: ${line.trim()}`);
      }
    });
  }
}

walk(sourceRoot);

if (offenders.length > 0) {
  console.error("Mojibake / corrupted UTF-8 markers found in source files:");
  for (const offender of offenders.slice(0, 80)) console.error(`- ${offender}`);
  if (offenders.length > 80) console.error(`...and ${offenders.length - 80} more.`);
  process.exit(1);
}

console.log("Mojibake scan passed.");
