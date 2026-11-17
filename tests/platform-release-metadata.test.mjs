import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const configSource = readFileSync(new URL('../config.js', import.meta.url), 'utf8');
const configBootstrap = configSource.slice(0, configSource.indexOf('\nfunction aeRoutePath'));
const context = {window: {}};
vm.runInNewContext(configBootstrap, context);
const config = context.window.AFGHAN_EATS_CONFIG;
const manifest = JSON.parse(readFileSync(new URL('../data/platform-release.json', import.meta.url), 'utf8'));

test('customer Android metadata identifies the verified private candidate, not a public release', () => {
  const customer = manifest.surfaces.customerNative;
  assert.equal(config.customerAndroidVersion, '1.2.9');
  assert.equal(config.customerAndroidVersionCode, 27);
  assert.equal(config.customerAndroidAvailability, 'private_candidate');
  assert.equal(config.customerAndroidPlayStatus, 'inactive_closed_testing_draft');
  assert.equal(config.customerAndroidInternalTestingVersion, '1.2.6');
  assert.equal(config.customerAndroidInternalTestingVersionCode, 24);
  assert.equal(config.customerAndroidInternalTestingStatus, 'active_not_reviewed');
  assert.equal(customer.sourceBranch, 'release/customer-play-1.2.9-build27');
  assert.equal(customer.sourceVersion, '1.2.9');
  assert.equal(customer.sourceAndroidBuild, 27);
  assert.equal(customer.playInternalTesting.status, 'active');
  assert.equal(customer.playInternalTesting.version, '1.2.6');
  assert.equal(customer.playInternalTesting.versionCode, 24);
  assert.equal(customer.playInternalTesting.reviewStatus, 'not_reviewed');
  assert.equal(customer.androidCandidate.version, '1.2.9');
  assert.equal(customer.androidCandidate.versionCode, 27);
  assert.equal(customer.androidCandidate.verificationStatus, 'verified_private_build');
  assert.equal(customer.androidCandidate.playStatus, 'inactive_closed_testing_draft');
  assert.equal(customer.androidCandidate.publicAvailability, 'not_public');
  assert.equal(customer.installedBuildVerified, false);
});

test('rider Android metadata keeps Play/public availability explicitly unconfirmed', () => {
  const rider = manifest.surfaces.riderNative;
  assert.equal(config.riderAndroidVersion, '1.1.11');
  assert.equal(config.riderAndroidVersionCode, 15);
  assert.equal(config.riderAndroidAvailability, 'private_candidate');
  assert.equal(config.riderAndroidPlayStatus, 'unconfirmed');
  assert.equal(rider.sourceVersion, '1.1.11');
  assert.equal(rider.sourceAndroidBuild, 15);
  assert.equal(rider.androidCandidate.version, '1.1.11');
  assert.equal(rider.androidCandidate.versionCode, 15);
  assert.equal(rider.androidCandidate.verificationStatus, 'signed_private_main_build');
  assert.equal(rider.androidCandidate.playStatus, 'unconfirmed');
  assert.equal(rider.androidCandidate.publicAvailability, 'unconfirmed');
  assert.equal(rider.installedBuildVerified, false);
});

test('Android store URLs remain unset and the release manifest path is unchanged', () => {
  assert.equal(config.customerAndroidUrl, '');
  assert.equal(config.customerIosUrl, '');
  assert.equal(config.releaseManifestUrl, '/data/platform-release.json');
});
