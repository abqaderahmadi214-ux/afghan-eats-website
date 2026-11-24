import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const home = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const navigation = fs.readFileSync(path.join(root, 'assets/marketplace-navigation.js'), 'utf8');
const page = fs.readFileSync(path.join(root, 'organizations/index.html'), 'utf8');
const build = fs.readFileSync(path.join(root, 'scripts/build-render-static.cjs'), 'utf8');
const sitemap = fs.readFileSync(path.join(root, 'sitemap.xml'), 'utf8');


test('homepage stays focused and links to the existing Afghan Eats Business page', () => {
  assert.match(home, /id="aeHomeAreaForm"/);
  assert.match(home, /name="area"/);
  assert.match(home, /id="aeHomeSearch"/);
  assert.match(home, /class="ae-home-business"/);
  assert.match(home, /Food for your organization’s programs\./);
  assert.match(home, /href="\/organizations\/"/);
  assert.match(home, /id="homeRestaurants"/);
  assert.doesNotMatch(home, /class="ae-org-promo"|class="ae-community"/);
  assert.match(home, /marketplace-navigation\.js/);
  assert.doesNotMatch(home, /ae-home-department-nav|ae-department-tile/);
  assert.doesNotMatch(home, /afghan-feast\.webp/);
  assert.match(navigation, /slug: 'restaurants',[^\n]*statusEn: 'Browse menus'/);
  for (const department of ['groceries', 'health-beauty', 'convenience', 'gifts', 'electronics', 'pet-supplies']) {
    assert.match(navigation, new RegExp(`slug: '${department}',[^\n]*statusEn: 'Coming soon'`));
  }
  assert.doesNotMatch(navigation, /slug: 'alcohol'/);
});

test('organizations page contains the verified service facts, support types, process and capacity limits', () => {
  for (const phrase of [
    'Food for your program, with local restaurants.',
    'Afghan Eats connects organizations with Herat restaurants',
    'Support for trainings and workshops',
    'Meals for meetings and events',
    'Staff and group meal orders',
    'Food delivery for program activities, where local capacity allows',
    'Share your requirements.',
    'We check local options.',
    'Review the proposal.',
    'We coordinate the confirmed service.',
    'Our current organizational service area is Herat.',
    'محدودهٔ کنونی خدمات سازمانی ما هرات است.',
    'We typically respond to quote requests within three business days.',
    'Availability, delivery areas, and order size depend on local restaurant capacity.',
    'Multi-location service is not confirmed until each location appears in an agreed written proposal.',
  ]) assert.ok(page.includes(phrase), `missing approved page copy: ${phrase}`);
  assert.match(page, /id="how-it-works"/);
  assert.match(page, /<main\b/);
  assert.match(page, /<title>Afghan Eats Business \| Food for Organizations<\/title>/);
  assert.match(page, /href="\/organizations\/" aria-current="page"/);
});

test('quote contact uses the existing mailbox and opens an email template rather than submitting a web form', () => {
  assert.match(page, /mailto:support@afghaneats\.net\?subject=Organizational%20food%20service%20quote&amp;body=Organization%3A/);
  assert.match(page, /support@afghaneats\.net/);
  assert.match(page, /attach your RFQ/i);
  assert.match(page, /Your email app opens with a request template/i);
  assert.match(page, /no web form is submitted/i);
  assert.match(page, /does not publish standard organizational payment or invoicing terms/i);
  assert.match(page, /quote-validity period, payment method and due date/i);
  assert.doesNotMatch(page, /<form\b/i);
});

test('existing restaurant-partner application remains linked and no duplicated organization page is added', () => {
  assert.match(page, /href="\/partner"/);
  assert.match(page, /Restaurant partner application/);
  assert.equal((home.match(/href="\/organizations\/"/g) || []).length >= 1, true);
  assert.doesNotMatch(home, /href="\/organizations\/new|href="\/business\/"/);
});

test('Render static build includes the organizations directory and sitemap lists its public URL', () => {
  assert.match(build, /\['assets',\s*'data',\s*'\.well-known',\s*'organizations'\]/);
  assert.match(sitemap, /https:\/\/afghaneats\.net\/organizations\//);
});

test('organization and homepage changes keep all public retail and order submission paths closed', () => {
  for (const text of [page, fs.readFileSync(path.join(root, 'assets/organizations.css'), 'utf8')]) {
    assert.doesNotMatch(text, /orders\.place|checkoutRequestKey|orderingEnabled|placeOrder\(/i);
  }
  assert.doesNotMatch(home, /class="ae-order-box"|onsubmit="if\(!saveAddress/);
  assert.match(home, /id="aeHomeAreaForm"/);
});
