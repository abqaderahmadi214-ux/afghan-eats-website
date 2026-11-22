import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const home = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const page = fs.readFileSync(path.join(root, 'organizations/index.html'), 'utf8');
const build = fs.readFileSync(path.join(root, 'scripts/build-render-static.cjs'), 'utf8');
const sitemap = fs.readFileSync(path.join(root, 'sitemap.xml'), 'utf8');

test('homepage promotes organization services with the approved copy and clear next steps', () => {
  assert.match(home, /class="ae-org-promo"/);
  assert.match(home, /Food services for your programs, powered by local restaurants\./);
  assert.match(home, /Afghan Eats helps organizations arrange meals for trainings, meetings, events, staff, and community programs/);
  assert.match(home, /Tell us where and when you need food, how many people you’re serving, and what you have in mind\./);
  assert.match(home, /href="\/organizations\/\#how-it-works"/);
});

test('organizations page contains all approved service types, process steps, and capacity caveat', () => {
  for (const phrase of [
    'Food services that fit your program.',
    'Support for trainings and workshops',
    'Meals for meetings and events',
    'Staff and group meal orders',
    'Food delivery for program activities, where local capacity allows',
    'Share your requirements.',
    'We check local options.',
    'Review the proposal.',
    'We coordinate the confirmed service.',
    'Serving more than one location?',
    'Availability, delivery areas, and order size depend on local restaurant capacity.',
  ]) assert.ok(page.includes(phrase), `missing approved page copy: ${phrase}`);
  assert.match(page, /id="how-it-works"/);
  assert.match(page, /<main\b/);
  assert.match(page, /<title>For Organizations \| Afghan Eats<\/title>/);
});

test('quote contact uses the existing support mailbox and does not pretend a web form was submitted', () => {
  assert.match(page, /mailto:support@afghaneats\.net\?subject=Organizational%20food%20service%20quote/);
  assert.match(page, /support@afghaneats\.net/);
  assert.match(page, /attach your RFQ/i);
  assert.match(page, /no web form is submitted/i);
  assert.doesNotMatch(page, /<form\b/i);
});

test('Render static build includes the organizations directory and sitemap lists its public URL', () => {
  assert.match(build, /\['assets',\s*'data',\s*'\.well-known',\s*'organizations'\]/);
  assert.match(sitemap, /https:\/\/afghaneats\.net\/organizations\//);
});

test('organization content adds no checkout or order-submission path', () => {
  for (const text of [page, fs.readFileSync(path.join(root, 'assets/organizations.css'), 'utf8')]) {
    assert.doesNotMatch(text, /orders\.place|checkoutRequestKey|orderingEnabled|placeOrder\(/i);
  }
  assert.match(home, /class="ae-order-box"/);
});
