const { test, expect } = require('@playwright/test');

async function expectHeaderControlsFit(page, locale) {
  const metrics = await page.locator('.header').evaluate(header => {
    const language = header.querySelector('.actions .lang');
    const logout = header.querySelector('.actions .btn');
    const langRect = language.getBoundingClientRect();
    const logoutRect = logout.getBoundingClientRect();
    const textRange = document.createRange();
    textRange.selectNodeContents(language);
    const textRect = textRange.getBoundingClientRect();

    return {
      label: language.textContent.trim(),
      flexShrink: getComputedStyle(language).flexShrink,
      button: { left: langRect.left, right: langRect.right },
      text: { left: textRect.left, right: textRect.right },
      logout: { left: logoutRect.left, right: logoutRect.right },
      documentOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    };
  });

  expect(metrics.label).toBe(locale === 'fa' ? 'English' : 'دری');
  expect(metrics.flexShrink).toBe(locale === 'fa' ? '0' : '1');
  expect(metrics.text.left).toBeGreaterThanOrEqual(metrics.button.left - 0.5);
  expect(metrics.text.right).toBeLessThanOrEqual(metrics.button.right + 0.5);
  const overlap = Math.max(
    0,
    Math.min(metrics.button.right, metrics.logout.right) - Math.max(metrics.button.left, metrics.logout.left),
  );
  expect(overlap).toBeLessThanOrEqual(0.5);
  expect(metrics.documentOverflow).toBeLessThanOrEqual(1);
}

test('owner header controls fit in English and Dari at desktop and phone widths', async ({ page }) => {
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto('/owner');
    await page.evaluate(() => localStorage.setItem('ae_lang', 'en'));
    await page.reload();
    await page.evaluate(() => document.fonts.ready);
    await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
    await expectHeaderControlsFit(page, 'en');

    await page.evaluate(() => localStorage.setItem('ae_lang', 'fa'));
    await page.reload();
    await page.evaluate(() => document.fonts.ready);
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expectHeaderControlsFit(page, 'fa');
  }
});
