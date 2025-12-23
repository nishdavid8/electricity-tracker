const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  // Navigate to the live URL
  await page.goto('https://www.canstarblue.com.au/electricity/compare/vic-electricity-plans/', { waitUntil: 'networkidle' });

  // Wait for the specific price elements to appear (handling the dynamic content)
  await page.waitForSelector('.annual-cost-value');

  const results = await page.evaluate(() => {
    const cards = Array.from(document.querySelectorAll('div[class*="plan-card-v2_"]'));
    return cards.map(card => {
      const brand = card.querySelector('img[class*="provider-logo_"]')?.alt || 'Unknown';
      const price = card.querySelector('.annual-cost-value')?.innerText.replace('$', '').replace(',', '') || '0';
      return { brand, price, timestamp: new Date().toISOString() };
    });
  });

  // Format data as CSV row: Timestamp, Brand, Price
  const csvRows = results.map(r => `"${r.timestamp}","${r.brand}",${r.price}`).join('\n');
  
  // Append to data.csv (create it if it doesn't exist)
  if (!fs.existsSync('data.csv')) {
    fs.writeFileSync('data.csv', 'Timestamp,Brand,Price\n');
  }
  fs.appendFileSync('data.csv', csvRows + '\n');

  await browser.close();
  console.log(`Successfully scraped ${results.length} plans.`);
})();
