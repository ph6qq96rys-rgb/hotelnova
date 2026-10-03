const { chromium } = require('@playwright/test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    const output = path.join(__dirname, '../test-results/menu-pricing');
    fs.mkdirSync(output, { recursive: true });
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('http://127.0.0.1:5174/tests/manual/menu-pricing.html');
      const vat = page.getByRole('spinbutton', { name: 'VAT (%)', exact: true });
      await vat.waitFor();
      assert.equal(await vat.isDisabled(), true);
      await page.getByRole('checkbox', { name: 'Company default' }).nth(0).uncheck();
      assert.equal(await vat.inputValue(), '15');
      await vat.fill('0');
      assert.match(await page.getByLabel('Saved rates').textContent(), /"vatRateOverride":0/);
      await page.getByRole('checkbox', { name: 'Company default' }).nth(1).uncheck();
      assert.equal(await page.getByRole('spinbutton', { name: 'Service charge (%)', exact: true }).inputValue(), '10');
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
      await page.screenshot({ path: path.join(output, `${width}.png`), fullPage: true });
      await page.getByRole('checkbox', { name: 'Company default' }).nth(0).check();
      assert.equal(await vat.isDisabled(), true);
      assert.match(await page.getByLabel('Saved rates').textContent(), /"vatRateOverride":null/);
    }
    console.log('Pricing controls passed at desktop and mobile widths.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
