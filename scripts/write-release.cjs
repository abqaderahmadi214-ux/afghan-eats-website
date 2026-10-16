const fs = require('node:fs');
const path = require('node:path');
const file = path.join(__dirname, '..', 'data', 'platform-release.json');
const release = JSON.parse(fs.readFileSync(file, 'utf8'));
const commit = process.env.COMMIT_REF || process.env.RENDER_GIT_COMMIT || '';
release.webBuild = { commit: /^[a-f0-9]{40}$/i.test(commit) ? commit : null, builtAt: new Date().toISOString() };
fs.writeFileSync(file, JSON.stringify(release, null, 2) + '\n');
console.log('[Afghan Eats] Public release metadata written.');
