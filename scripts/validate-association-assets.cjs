const fs = require("node:fs");
const path = require("node:path");

const assetsDirectory = path.resolve(__dirname, "..", ".well-known");
const fingerprint = "01:76:4E:62:3F:C4:84:2A:AF:55:4F:E3:D6:D8:D6:30:A6:37:A6:A4:03:5A:33:EF:43:7A:14:07:45:4B:DE:C7";
const assetLinks = JSON.parse(fs.readFileSync(path.join(assetsDirectory, "assetlinks.json"), "utf8"));

if (assetLinks.length !== 1 || assetLinks[0]?.target?.package_name !== "com.app.afghaneatsmobile" || assetLinks[0]?.target?.sha256_cert_fingerprints?.[0] !== fingerprint) {
  throw new Error("Android assetlinks.json does not match the verified Afghan Eats app-signing identity.");
}

const appleOutput = path.join(assetsDirectory, "apple-app-site-association");
const expectedTeamId = process.env.EXPECT_APPLE_TEAM_ID;
if (expectedTeamId) {
  const appleAssociation = JSON.parse(fs.readFileSync(appleOutput, "utf8"));
  if (appleAssociation.applinks?.details?.[0]?.appID !== `${expectedTeamId}.com.app.afghaneatsmobile`) {
    throw new Error("Rendered Apple association metadata does not match the expected Team ID.");
  }
} else if (fs.existsSync(appleOutput)) {
  throw new Error("Apple association metadata must not be published before APPLE_TEAM_ID is configured.");
}

console.log("Association asset validation passed.");
