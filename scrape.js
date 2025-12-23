const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
  const browser = await chromium.launch({ headless: true });
  // Adding more "human" details to the browser identity
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  });
  const page = await context.newPage();
  
  try {
    console.log("1. Navigating to Canstar...");
    await page.goto('https://www.canstarblue.com.au/electricity/compare/vic-electricity-plans/', { 
      waitUntil: 'networkidle',
      timeout: 60000 
    });

    // 2. Target the postcode field using its common attributes
    console.log("2. Looking for the postcode box...");
    const input = page.locator('input[placeholder*="postcode"], input#postcode-selector').first();
    await input.waitFor({ state: 'visible' });
    
    // Click, then Fill (more reliable than 'type')
    await input.click();
    await input.fill('3000'); 
    console.log("3. Postcode entered.");

    // 4. Submit the form using the keyboard 'Enter' key
    // This is often more reliable than clicking the button on interactive maps
    await page.keyboard.press('Enter');
    console.log("4. Enter key pressed. Waiting for results...");

    // 5. Wait for the prices to appear
    // We look for the "annual-cost-value" which only appears on the results page
    await page.waitForSelector('.annual-cost-value', { timeout: 90000 });

    const results = await page.evaluate(() => {
      const items = Array.from(document.querySelectorAll('div[class*="plan-card-v2_"]'));
      return items.map(item => {
        const brand = item.querySelector('img[class*="provider-logo_"]')?.alt || 'Unknown';
        const price = item.querySelector('.annual-cost-value')?.innerText.replace(/[^0-9.]/g, '') || '0';
        return { brand, price, timestamp: new Date().toISOString() };
      });
    });

    console.log(`Success! Found ${results.length} plans.`);

    // 6. Save to CSV
    const csvRows = results.map(r => `"${r.timestamp}","${r.brand}",${r.price}`).join('\n');
    if (!fs.existsSync('data.csv')) {
      fs.writeFileSync('data.csv', 'Timestamp,Brand,Price\n');
    }
    fs.appendFileSync('data.csv', csvRows + '\n');

  } catch (error) {
    console.error("Scraper failed at step:", error.message);
    // This screenshot will tell us if '3000' actually appeared in the box
    await page.screenshot({ path: 'final-attempt-debug.png' });
    process.exit(1);
  } finally {
    await browser.close();
  }
})();
