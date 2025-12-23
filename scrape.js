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

    // --- STEP: HANDLING THE POSTCODE PROMPT ---
    const postcodeSelector = 'input[placeholder*="postcode"]';
    if (await page.isVisible(postcodeSelector)) {
        console.log("Postcode prompt found. Entering 3000...");
        await page.fill(postcodeSelector, '3000');
        await page.keyboard.press('Enter');
        await page.waitForTimeout(5000); // Wait for results to load
    }

    // Wait for the actual prices to appear after the postcode is processed
    console.log("Waiting for prices to appear...");
    await page.waitForSelector('.annual-cost-value', { timeout: 60000 });

    const latestData = await page.evaluate(() => {
      const cards = Array.from(document.querySelectorAll('div[class*="plan-card-v2_"]'));
      return cards.map(card => {
        const brand = card.querySelector('img[class*="provider-logo_"]')?.alt || 'Unknown';
        const price = card.querySelector('.annual-cost-value')?.innerText.replace(/[^0-9.]/g, '') || '0';
        return { brand, price, timestamp: new Date().toISOString() };
      });
    });

    console.log(`Success! Scraped ${latestData.length} plans.`);

    // Save to CSV
    const csvRows = latestData.map(r => `"${r.timestamp}","${r.brand}",${r.price}`).join('\n');
    if (!fs.existsSync('data.csv')) {
      fs.writeFileSync('data.csv', 'Timestamp,Brand,Price\n');
    }
    fs.appendFileSync('data.csv', csvRows + '\n');

  } catch (error) {
    console.error("Scraper failed:", error.message);
    await page.screenshot({ path: 'error.png' }); // Takes a picture of what went wrong
    process.exit(1);
  } finally {
    await browser.close();
  }
})();
