const http = require('node:http');
const { once } = require('node:events');
const { test, expect } = require('@playwright/test');

const productionApi = 'https://afghaneats-api.onrender.com';
const endpoint = '/api/trpc/operations.applyPartner';

async function startLocalBackend() {
  let resolveReceived;
  let resolveResponse;
  let responseReleased = false;
  let postCount = 0;
  const received = new Promise(resolve => { resolveReceived = resolve; });
  const pendingResponse = new Promise(resolve => { resolveResponse = resolve; });

  const server = http.createServer(async (request, response) => {
    const corsHeaders = {
      'Access-Control-Allow-Origin': request.headers.origin || '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'content-type, accept',
      'Access-Control-Max-Age': '0',
      Vary: 'Origin'
    };

    if (request.method === 'OPTIONS') {
      response.writeHead(204, corsHeaders);
      response.end();
      return;
    }

    const pathname = new URL(request.url, 'http://127.0.0.1').pathname;
    if (request.method !== 'POST' || pathname !== endpoint) {
      response.writeHead(404, corsHeaders);
      response.end();
      return;
    }

    postCount += 1;
    let rawBody = '';
    for await (const chunk of request) rawBody += chunk;
    resolveReceived({ method: request.method, pathname, body: JSON.parse(rawBody) });

    const outcome = await pendingResponse;
    response.writeHead(outcome.status, {
      ...corsHeaders,
      'Content-Type': 'application/json; charset=utf-8'
    });
    response.end(JSON.stringify(outcome.body));
  });

  const listening = once(server, 'listening');
  server.listen(0, '127.0.0.1');
  await listening;
  const { port } = server.address();

  return {
    baseUrl: `http://127.0.0.1:${port}`,
    received,
    get postCount() { return postCount; },
    respond(body, status = 200) {
      if (responseReleased) throw new Error('The local test backend already responded');
      responseReleased = true;
      resolveResponse({ body, status });
    },
    async close() {
      if (!responseReleased) {
        responseReleased = true;
        resolveResponse({ status: 503, body: { error: 'Local test backend closed' } });
      }
      const closed = new Promise((resolve, reject) => {
        server.close(error => error ? reject(error) : resolve());
      });
      // Playwright may retain the completed response's keep-alive socket until
      // its page fixture tears down, after this afterEach hook has started.
      server.closeAllConnections();
      await closed;
    }
  };
}

async function completeValidForm(page) {
  await page.goto('/partner-onboarding');

  await page.locator('[name="restaurantName"]').fill('The Saffron Courtyard');
  await page.locator('[name="ownerName"]').fill('Farid Ahmadi');
  await page.locator('[name="phone"]').fill('+93700000000');
  await page.locator('[name="whatsapp"]').fill('+93700000001');
  await page.locator('[name="email"]').fill('test-restaurant@example.test');
  await page.locator('[name="district"]').fill('Tank Markaz');
  await page.locator('[name="address"]').fill('Main Market Road, near the bazaar');
  await page.locator('#onboardingNext').click();

  await page.locator('[name="cuisine"]').fill('Afghan, kebab');
  await page.locator('[name="menuUrl"]').fill('https://saffron.example/menu');
  await page.locator('[name="menuItems"]').fill('Kabuli pulao — 250 AFN');
  await page.locator('[name="menuNotes"]').fill('Family platters');
  await page.locator('#onboardingNext').click();

  await page.locator('[name="deliveryModel"]').selectOption('both');
  await page.locator('[name="deliveryZones"]').fill('Tank Markaz, Jebrael');
  await page.locator('#onboardingNext').click();

  await page.locator('[name="payoutMethod"]').selectOption('bank_transfer');
  await page.locator('[name="payoutName"]').fill('Farid Ahmadi');
  await page.locator('[name="payoutPhone"]').fill('+93700000000');
}

test.describe('restaurant partner onboarding browser journey', () => {
  let backend;
  let externalRequests;

  test.beforeEach(async ({ page }) => {
    backend = await startLocalBackend();
    externalRequests = [];

    // Keep every HTTP request local and log any attempted external destination.
    await page.route('**/*', async route => {
      const origin = new URL(route.request().url()).origin;
      if (origin === 'http://127.0.0.1:4173' || origin === backend.baseUrl) {
        await route.continue();
        return;
      }
      externalRequests.push(route.request().url());
      await route.abort();
    });

    // Repoint the page to the isolated local HTTP receiver.
    await page.route('**/config.js*', async route => {
      const originalResponse = await route.fetch();
      const script = await originalResponse.text();
      if (!script.includes(productionApi)) {
        throw new Error('The expected API base URL was not found in config.js');
      }
      await route.fulfill({
        response: originalResponse,
        body: script.replaceAll(productionApi, backend.baseUrl)
      });
    });
  });

  test.afterEach(async () => {
    await backend?.close();
    backend = undefined;
  });

  test('sends the valid application to the backend and waits for confirmed receipt before success', async ({ page }) => {
    const pageErrors = [];
    page.on('pageerror', error => pageErrors.push(error.message));

    await completeValidForm(page);
    await page.locator('#onboardingSubmit').click();

    const submission = await backend.received;
    expect(backend.postCount).toBe(1);
    expect(submission.method).toBe('POST');
    expect(submission.pathname).toBe(endpoint);
    expect(submission.body).toEqual({
      json: {
        restaurantName: 'The Saffron Courtyard',
        ownerName: 'Farid Ahmadi',
        phone: '+93700000000',
        whatsapp: '+93700000001',
        email: 'test-restaurant@example.test',
        district: 'Tank Markaz',
        address: 'Main Market Road, near the bazaar',
        deliveryModel: 'both',
        cuisine: 'Afghan, kebab',
        notes: [
          'Menu items: Kabuli pulao — 250 AFN',
          'Menu notes: Family platters',
          'Menu link: https://saffron.example/menu',
          'Delivery zones: Tank Markaz, Jebrael',
          'Payout method: bank_transfer',
          'Payout contact name: Farid Ahmadi',
          'Payout contact phone: +93700000000'
        ].join('\n')
      }
    });

    const result = page.locator('#partnerOnboardingResult');
    await expect(result).toBeHidden();
    await expect(page.locator('#onboardingSubmit')).toBeDisabled();
    expect(externalRequests).toEqual([]);

    backend.respond({
      result: {
        data: {
          json: {
            success: true,
            duplicate: false,
            reference: 'AEP-LOCAL-TEST-001',
            emailVerified: false,
            verificationEmailSent: true
          }
        }
      }
    });

    await expect(result).toBeVisible();
    await expect(result).toHaveClass(/success/);
    await expect(result).toContainText('Your application was submitted');
    await expect(result).toContainText('AEP-LOCAL-TEST-001');
    await expect(result).toContainText('verification link was sent');
    await expect(page.locator('[name="restaurantName"]')).toHaveValue('');
    await expect(page.locator('[data-onboarding-step]').first()).toBeVisible();
    await expect(page.locator('[data-step-indicator]').first()).toHaveClass(/active/);
    await expect(page.locator('#onboardingSubmit')).toBeEnabled();
    expect(pageErrors).toEqual([]);
    expect(backend.postCount).toBe(1);
    expect(externalRequests).toEqual([]);
  });

  test('does not show success for an HTTP response without a confirmed reference', async ({ page }) => {
    await completeValidForm(page);
    await page.locator('#onboardingSubmit').click();

    const submission = await backend.received;
    expect(backend.postCount).toBe(1);
    expect(submission.body.json.email).toBe('test-restaurant@example.test');
    backend.respond({
      result: {
        data: {
          json: {
            success: true,
            duplicate: false,
            reference: '   ',
            emailVerified: false,
            verificationEmailSent: true
          }
        }
      }
    });

    const result = page.locator('#partnerOnboardingResult');
    await expect(result).toBeVisible();
    await expect(result).toHaveClass(/error/);
    await expect(result).toContainText("couldn't confirm");
    await expect(result).not.toContainText('Your application was submitted');
    await expect(page.locator('[name="restaurantName"]')).toHaveValue('The Saffron Courtyard');
    expect(backend.postCount).toBe(1);
    expect(externalRequests).toEqual([]);
  });
});
