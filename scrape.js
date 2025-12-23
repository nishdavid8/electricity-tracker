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

    // 1. Focus and Type Postcode
    console.log("Locating postcode box...");
    const inputSelector = 'input[id="postcode-selector"], input[placeholder*="postcode"]';
    await page.waitForSelector(inputSelector);
    
    await page.click(inputSelector); // Click first to focus
    await page.waitForTimeout(1000); // Wait 1 second for the box to be ready
    await page.type(inputSelector, '3000', { delay: 100 }); // Type slowly
    console.log("Postcode entered.");

    // 2. Click the Compare Button
    console.log("Clicking the Compare button...");
    // We'll try to click the button based on the teal box we see in your screenshot
    await page.click('button:has-text("COMPARE"), .postcode-selector-submit');

    // 3. Wait for the Price Results
    console.log("Waiting for results page to load...");
    // Increased timeout to 90 seconds because the transition can be slow
    await page.waitForSelector('.annual-cost-value', { timeout: 90000 });

    const latestData = await page.evaluate(() => {
      const cards = Array.from(document.querySelectorAll('div[class*="plan-card-v2_"]'));
      return cards.map(card => {
        const brand = card.querySelector('img[class*="provider-logo_"]')?.alt || 'Unknown';
        const price = card.querySelector('.annual-cost-value')?.innerText.replace(/[^0-9.]/g, '') || '0';
        return { brand, price, timestamp: new Date().toISOString() };
      });
    });

    console.log(`Success! Captured ${latestData.length} plans.`);

    const csvRows = latestData.map(r => `"${r.timestamp}","${r.brand}",${r.price}`).join('\n');
    if (!fs.existsSync('data.csv')) {
      fs.writeFileSync('data.csv', 'Timestamp,Brand,Price\n');
    }
    fs.appendFileSync('data.csv', csvRows + '\n');

  } catch (error) {
    console.error("Scraper failed:", error.message);
    // Take a screenshot of exactly where it stopped
    await page.screenshot({ path: 'failed-step.png' }); 
    process.exit(1);
  } finally {
    await browser.close();
  }
})();
