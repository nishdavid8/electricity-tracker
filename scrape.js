const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  });
  const page = await context.newPage();
  
  try {
    console.log("Navigating to Canstar Blue...");
    await page.goto('https://www.canstarblue.com.au/electricity/compare/vic-electricity-plans/', { 
      waitUntil: 'networkidle',
      timeout: 60000 
    });

    // 1. Enter the postcode into the box seen in your screenshot
    console.log("Entering postcode...");
    const inputSelector = 'input[name="postcode"], input[placeholder*="postcode"]';
    await page.waitForSelector(inputSelector);
    await page.fill(inputSelector, '3000');

    // 2. Click the 'COMPARE' button
    console.log("Clicking Compare...");
    await page.click('button:has-text("COMPARE")');

    // 3. Wait for the new page to load the price results
    console.log("Waiting for price results to appear...");
    await page.waitForSelector('.annual-cost-value', { timeout: 60000 });

    const latestData = await page.evaluate(() => {
      const cards = Array.from(document.querySelectorAll('div[class*="plan-card-v2_"]'));
      return cards.map(card => {
        const brand = card.querySelector('img[class*="provider-logo_"]')?.alt || 'Unknown';
        const price = card.querySelector('.annual-cost-value')?.innerText.replace(/[^0-9.]/g, '') || '0';
        return { brand, price, timestamp: new Date().toISOString() };
      });
    });

    console.log(`Success! Captured ${latestData.length} plans.`);

    // 4. Save to CSV
    const csvRows = latestData.map(r => `"${r.timestamp}","${r.brand}",${r.price}`).join('\n');
    if (!fs.existsSync('data.csv')) {
      fs.writeFileSync('data.csv', 'Timestamp,Brand,Price\n');
    }
    fs.appendFileSync('data.csv', csvRows + '\n');

  } catch (error) {
    console.error("Scraper failed at this step:", error.message);
    await page.screenshot({ path: 'error-at-postcode.png' }); 
    process.exit(1);
  } finally {
    await browser.close();
  }
})();
