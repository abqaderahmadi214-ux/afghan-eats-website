const fs = require("node:fs");
const path = require("node:path");

const assetsDirectory = path.resolve(__dirname, "..", ".well-known");
const templatePath = path.join(assetsDirectory, "apple-app-site-association.template");
const outputPath = path.join(assetsDirectory, "apple-app-site-association");
const appleTeamId = (process.env.APPLE_TEAM_ID ?? "").trim().toUpperCase();

if (!appleTeamId) {
  fs.rmSync(outputPath, { force: true });
  console.log("APPLE_TEAM_ID is not configured; iOS Universal Link metadata was not published.");
  process.exit(0);
}

if (!/^[A-Z0-9]{10}$/.test(appleTeamId)) {
  throw new Error("APPLE_TEAM_ID must be a 10-character Apple Developer Team ID.");
}

const rendered = fs.readFileSync(templatePath, "utf8").replace("${APPLE_TEAM_ID}", appleTeamId);
JSON.parse(rendered);
fs.writeFileSync(outputPath, rendered);
console.log("Rendered iOS Universal Link metadata from APPLE_TEAM_ID.");
