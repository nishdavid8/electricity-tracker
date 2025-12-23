const { chromium } = require('playwright');
const fs = require('fs');

async function dismissOverlays(page) {
  const buttons = [
    'button:has-text("Accept")',
    'button:has-text("I agree")',
    'button:has-text("Allow")',
    'button:has-text("Agree")'
  ];

  for (const btn of buttons) {
    try {
      await page.click(btn, { timeout: 3000 });
      console.log('✓ Overlay dismissed');
      break;
    } catch (_) {}
  }
}

async function findPostcodeInput(page) {
  return await page.waitForFunction(() => {
    const input = Array.from(document.querySelectorAll('input')).find(i =>
      i.type === 'text' &&
      (
        i.placeholder?.toLowerCase().includes('post') ||
        i.name?.toLowerCase().includes('post') ||
        i.id?.toLowerCase().includes('post')
      )
    );
    return input || false;
  }, { timeout: 60000 });
}

async function setPostcode(page, handle, postcode) {
  // Attempt 1: Native setter (React-safe)
  try {
    await handle.evaluate((el, val) => {
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
    }, postcode);

    console.log('✓ Postcode set via native setter');
    return;
  } catch (_) {}

  // Attempt 2: Keyboard fallback
  await handle.click({ force: true });
  await page.keyboard.press('Control+A');
  await page.keyboard.type(postcode, { delay: 80 });
  console.log('✓ Postcode set via keyboard fallback');
}

(async () => {
  const browser = await chromium.launch({ headless: true });

  const context = await browser.newContext({
    locale: 'en-AU',
    timezoneId: 'Australia/Melbourne',
    geolocation: { latitude: -37.8136, longitude: 144.9631 },
    permissions: ['geolocation'],
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  });

  const page = await context.newPage();

  page.on('console', msg =>
    console.log(`[browser:${msg.type()}] ${msg.text()}`)
  );

  try {
    console.log('1. Navigating to Canstar...');
    await page.goto(
      'https://www.canstarblue.com.au/electricity/compare/vic-electricity-plans/',
      { waitUntil: 'domcontentloaded', timeout: 60000 }
    );

    await dismissOverlays(page);

    // Allow SPA hydration
    await page.waitForTimeout(3000);

    await page.screenshot({ path: 'before-postcode.png', fullPage: true });

    console.log('2. Locating postcode input...');
    const postcodeHandle = await findPostcodeInput(page);

    if (!postcodeHandle) {
      throw new Error('Postcode input not found');
    }

    console.log('3. Setting postcode...');
    await setPostcode(page, postcodeHandle, '3000');

    console.log('4. Waiting for COMPARE button...');
    const compareSelector = 'button:has-text("COMPARE"), button[type="submit"]';

    await page.waitForFunction(sel => {
      const btn = document.querySelector(sel);
      return btn && !btn.disabled;
    }, compareSelector, { timeout: 30000 });

    console.log('5. Clicking COMPARE...');
    await page.click(compareSelector, { force: true });

    console.log('6. Waiting for price results...');
    await page.waitForSelector('.annual-cost-value', {
      timeout: 90000
    });

    const results = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('div[class*="plan"]')).map(card => ({
        brand: card.querySelector('img')?.alt || 'Unknown',
        price:
          card.querySelector('.annual-cost-value')
            ?.innerText.replace(/[^0-9.]/g, '') || '0',
        timestamp: new Date().toISOString()
      }));
    });

    console.log(`✓ Captured ${results.length} plans`);

    const csv = results
      .map(r => `"${r.timestamp}","${r.brand}",${r.price}`)
      .join('\n');

    if (!fs.existsSync('data.csv')) {
      fs.writeFileSync('data.csv', 'Timestamp,Brand,Price\n');
    }

    fs.appendFileSync('data.csv', csv + '\n');

  } catch (err) {
    console.error('❌ Scraper failed:', err.message);
    await page.screenshot({ path: 'fatal-error.png', fullPage: true });
    process.exit(1);
  } finally {
    await browser.close();
  }
})();
