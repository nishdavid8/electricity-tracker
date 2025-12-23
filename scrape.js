const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
  // 1. Launch with a "User Agent" so we look like a real person, not a bot
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36'
  });
  const page = await context.newPage();
  
  console.log("Navigating to Canstar Blue...");
  try {
    // 2. Increase the timeout to 60 seconds (60000ms)
    await page.goto('https://www.canstarblue.com.au/electricity/compare/vic-electricity-plans/', { 
      waitUntil: 'domcontentloaded', 
      timeout: 60000 
    });

    console.log("Waiting for prices to appear...");
    // 3. Wait up to 60 seconds for the prices
    await page.waitForSelector('.annual-cost-value', { timeout: 60000 });

    const results = await page.evaluate(() => {
      const cards = Array.from(document.querySelectorAll('div[class*="plan-card-v2_"]'));
      return cards.map(card => {
        const brand = card.querySelector('img[class*="provider-logo_"]')?.alt || 'Unknown';
        const price = card.querySelector('.annual-cost-value')?.innerText.replace(/[^0-9.]/g, '') || '0';
        return { brand, price, timestamp: new Date().toISOString() };
      });
    });

    console.log(`Found ${results.length} plans. Saving to CSV...`);
    const csvRows = results.map(r => `"${r.timestamp}","${r.brand}",${r.price}`).join('\n');
    
    if (!fs.existsSync('data.csv')) {
      fs.writeFileSync('data.csv', 'Timestamp,Brand,Price\n');
    }
    fs.appendFileSync('data.csv', csvRows + '\n');
    console.log("Done!");

  } catch (error) {
    console.error("The scraper failed with this error:", error.message);
    process.exit(1); // Tell GitHub it failed
  } finally {
    await browser.close();
  }
})();
