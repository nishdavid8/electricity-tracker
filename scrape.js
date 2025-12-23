const { chromium } = require('playwright');
const fs = require('fs');

async function setPostcode(page, selector, postcode) {
  await page.waitForSelector(selector, { state: 'visible', timeout: 60000 });

  // -------- Attempt 1: Playwright fill ----------
  try {
    await page.locator(selector).fill(postcode);
    await page.waitForTimeout(300);

    const val = await page.$eval(selector, el => el.value);
    if (val === postcode) {
      console.log('✓ Postcode set via locator.fill');
      return;
    }
  } catch (_) {}

  // -------- Attempt 2: Native setter (React-safe) ----------
  try {
    await page.evaluate((sel, val) => {
      const el = document.querySelector(sel);
      const setter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        'value'
      ).set;

      setter.call(el, val);
      el.dispatchEvent(new InputEvent('input', {
        bubbles: true,
        data: val,
        inputType: 'insertText'
      }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      el.dispatchEvent(new Event('blur', { bubbles: true }));
    }, selector, postcode);

    await page.waitForTimeout(300);

    const val = await page.$eval(selector, el => el.value);
    if (val === postcode) {
      console.log('✓ Postcode set via native setter');
      return;
    }
  } catch (_) {}

  // -------- Attempt 3: Keyboard typing (human fallback) ----------
  try {
    await page.click(selector, { force: true });
    await page.keyboard.press('Control+A');
    await page.keyboard.type(postcode, { delay: 80 });

    await page.waitForTimeout(300);

    const val = await page.$eval(selector, el => el.value);
    if (val === postcode) {
      console.log('✓ Postcode set via keyboard typing');
      return;
    }
  } catch (e) {
    throw new Error(`Failed to set postcode: ${e.message}`);
  }

  throw new Error('All postcode entry attempts failed');
}

(async () => {
  const browser = await chromium.launch({
    headless: true
    // For debugging:
    // headless: false,
    // slowMo: 50
  });

  const context = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  });

  const page = await context.newPage();

  // Capture browser console logs (critical for SPAs)
  page.on('console', msg => {
    console.log(`[browser:${msg.type()}] ${msg.text()}`);
  });

  try {
    console.log('1. Navigating to Canstar...');
    await page.goto(
      'https://www.canstarblue.com.au/electricity/compare/vic-electricity-plans/',
      {
        waitUntil: 'networkidle',
        timeout: 60000
      }
    );

    // Wait for SPA hydration signal
    await page.waitForTimeout(2000);

    console.log('2. Setting postcode...');
    const postcodeSelector = 'input[placeholder*="postcode"], #postcode-selector';
    await setPostcode(page, postcodeSelector, '3000');

    console.log('3. Waiting for COMPARE to become interactive...');
    const compareBtn = 'button:has-text("COMPARE"), .postcode-selector-submit';

    await page.waitForFunction(
      sel => {
        const btn = document.querySelector(sel);
        return btn && !btn.disabled;
      },
      compareBtn,
      { timeout: 30000 }
    );

    console.log('4. Clicking COMPARE...');
    await page.click(compareBtn, { force: true });

    console.log('5. Waiting for price results...');
    await page.waitForSelector('.annual-cost-value', {
      timeout: 90000
    });

    const results = await page.evaluate(() => {
      const cards = Array.from(
        document.querySelectorAll('div[class*="plan-card"]')
      );

      return cards.map(card => ({
        brand:
          card.querySelector('img')?.alt ||
          'Unknown',
        price:
          card.querySelector('.annual-cost-value')
            ?.innerText.replace(/[^0-9.]/g, '') || '0',
        timestamp: new Date().toISOString()
      }));
    });

    console.log(`✓ Success! Captured ${results.length} plans`);

    const csvRows = results
      .map(r => `"${r.timestamp}","${r.brand}",${r.price}`)
      .join('\n');

    if (!fs.existsSync('data.csv')) {
      fs.writeFileSync('data.csv', 'Timestamp,Brand,Price\n');
    }

    fs.appendFileSync('data.csv', csvRows + '\n');

  } catch (error) {
    console.error('❌ Script failed:', error.message);
    await page.screenshot({ path: 'failure-debug.png', fullPage: true });
    process.exit(1);
  } finally {
    await browser.close();
  }
})();
