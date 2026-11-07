const fs = require("node:fs");
const crypto = require("node:crypto");
const path = require("node:path");

const filePath = process.argv[2];
if (!filePath) {
  console.error("Usage: npm run hash:certificate -- <path-to-certificate-file>");
  process.exit(1);
}

try {
  const absolutePath = path.resolve(filePath);
  const fileBytes = fs.readFileSync(absolutePath);
  const digest = crypto.createHash("sha256").update(fileBytes).digest("hex");
  console.log(`File: ${absolutePath}`);
  console.log(`SHA-256: 0x${digest}`);
} catch (error) {
  console.error(`Could not hash file: ${error.message}`);
  process.exit(1);
}
