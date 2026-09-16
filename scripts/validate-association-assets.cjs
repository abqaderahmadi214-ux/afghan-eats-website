const fs = require("node:fs");
const path = require("node:path");

const assetsDirectory = path.resolve(__dirname, "..", ".well-known");
const expectedAndroidApps = [
  {
    packageName: "net.afghaneats.customer",
    fingerprint: "75:AC:F9:BF:D8:56:4C:A4:59:E0:F2:1C:66:49:EA:DE:C2:80:74:BE:E9:55:30:5D:E9:D7:FF:06:BB:F8:6E:F8",
  },
  {
    packageName: "net.afghaneats.rider",
    fingerprint: "9F:1F:B4:F9:E2:76:F7:82:DB:E8:91:E2:04:95:A4:61:0F:D4:8B:62:BD:40:82:B7:A3:01:5C:50:1D:FE:57:1F",
  },
];

const assetLinks = JSON.parse(fs.readFileSync(path.join(assetsDirectory, "assetlinks.json"), "utf8"));
for (const expected of expectedAndroidApps) {
  const entry = assetLinks.find(item => item?.target?.package_name === expected.packageName);
  if (!entry || !entry.target.sha256_cert_fingerprints?.includes(expected.fingerprint)) {
    throw new Error(`Android assetlinks.json is missing the verified release identity for ${expected.packageName}.`);
  }
}

const appleOutput = path.join(assetsDirectory, "apple-app-site-association");
const expectedTeamId = process.env.EXPECT_APPLE_TEAM_ID;
if (expectedTeamId) {
  const appleAssociation = JSON.parse(fs.readFileSync(appleOutput, "utf8"));
  if (appleAssociation.applinks?.details?.[0]?.appID !== `${expectedTeamId}.net.afghaneats.customer`) {
    throw new Error("Rendered Apple association metadata does not match the expected Customer bundle ID and Team ID.");
  }
} else if (fs.existsSync(appleOutput)) {
  throw new Error("Apple association metadata must not be published before APPLE_TEAM_ID is configured.");
}

console.log("Association asset validation passed.");
