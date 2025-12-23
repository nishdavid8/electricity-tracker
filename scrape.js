const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  });
  const page = await context.newPage();
  
  try {
    console.log("1. Navigating to Canstar Blue...");
    await page.goto('https://www.canstarblue.com.au/electricity/compare/vic-electricity-plans/', { 
      waitUntil: 'networkidle',
      timeout: 60000 
    });

    console.log("2. Forcing postcode interaction...");
    // Target the specific postcode input
    const selector = 'input[placeholder*="postcode"], #postcode-selector';
    await page.waitForSelector(selector);
    
    // We use evaluate to bypass standard "typing" and force the value directly 
    // into the website's internal state.
    await page.evaluate((sel) => {
        const el = document.querySelector(sel);
        el.value = '3000';
        // These events "wake up" the website's internal logic
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
        el.dispatchEvent(new Event('blur', { bubbles: true }));
    }, selector);

    console.log("3. Attempting to click COMPARE...");
    // Some buttons are hidden behind overlays; we'll use a force-click
    const compareBtn = 'button:has-text("COMPARE"), .postcode-selector-submit';
    await page.click(compareBtn, { force: true });

    console.log("4. Waiting for price results...");
    // We increase timeout as the redirect can be slow
    await page.waitForSelector('.annual-cost-value', { timeout: 90000 });

    const results = await page.evaluate(() => {
      const cards = Array.from(document.querySelectorAll('div[class*="plan-card-v2_"]'));
      return cards.map(card => {
        const brand = card.querySelector('img[class*="provider-logo_"]')?.alt || 'Unknown';
        const price = card.querySelector('.annual-cost-value')?.innerText.replace(/[^0-9.]/g, '') || '0';
        return { brand, price, timestamp: new Date().toISOString() };
      });
    });

    console.log(`Success! Captured ${results.length} plans.`);

    const csvRows = results.map(r => `"${r.timestamp}","${r.brand}",${r.price}`).join('\n');
    if (!fs.existsSync('data.csv')) {
      fs.writeFileSync('data.csv', 'Timestamp,Brand,Price\n');
    }
    fs.appendFileSync('data.csv', csvRows + '\n');

  } catch (error) {
    console.error("Failed at step:", error.message);
    await page.screenshot({ path: 'event-debug.png' }); 
    process.exit(1);
  } finally {
    await browser.close();
  }
})();
