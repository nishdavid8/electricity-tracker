const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
  // 1. Launch a browser that looks like a real person (User Agent)
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36'
  });
  const page = await context.newPage();
  
  try {
    console.log("Navigating to VIC comparison page...");
    await page.goto('https://www.canstarblue.com.au/electricity/compare/vic-electricity-plans/', { 
      waitUntil: 'networkidle',
      timeout: 60000 
    });

    // 2. Take a "Debug Screenshot" to see if we are blocked or stuck on a postcode screen
    await page.screenshot({ path: 'debug-screenshot.png', fullPage: true });
    console.log("Screenshot saved as debug-screenshot.png");

    // 3. Robust wait: check for EITHER the price OR a common "Postcode" input
    console.log("Waiting for prices to load...");
    await page.waitForSelector('.annual-cost-value', { timeout: 60000 });

    const results = await page.evaluate(() => {
      const cards = Array.from(document.querySelectorAll('div[class*="plan-card-v2_"]'));
      return cards.map(card => {
        const brand = card.querySelector('img[class*="provider-logo_"]')?.alt || 'Unknown Brand';
        const price = card.querySelector('.annual-cost-value')?.innerText.replace(/[^0-9.]/g, '') || '0';
        return { brand, price, timestamp: new Date().toISOString() };
      });
    });

    console.log(`Success! Found ${results.length} plans.`);
    const csvRows = results.map(r => `"${r.timestamp}","${r.brand}",${r.price}`).join('\n');
    
    if (!fs.existsSync('data.csv')) {
      fs.writeFileSync('data.csv', 'Timestamp,Brand,Price\n');
    }
    fs.appendFileSync('data.csv', csvRows + '\n');

  } catch (err) {
    console.error("The scraper timed out. Check the debug-screenshot.png in the Actions tab!");
    // Save another screenshot specifically of the error state
    await page.screenshot({ path: 'error-state.png' });
    process.exit(1); 
  } finally {
    await browser.close();
  }
})();
