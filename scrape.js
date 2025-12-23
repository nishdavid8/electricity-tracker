const fs = require('fs');

async function scrape() {
  const ENDPOINT = 'https://www.canstar.com.au/spark/api/compare/energy';
  
  // This is the "hidden message" we send to Canstar
  const payload = {
    fuelType: 'electricity',
    postcode: '3000',
    state: 'VIC',
    customerType: 'residential'
  };

  console.log('Fetching electricity plans directly from API...');

  try {
    const response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Origin': 'https://www.canstarblue.com.au',
        'Referer': 'https://www.canstarblue.com.au/'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`Canstar API error: ${response.status}`);
    }

    const data = await response.json();
    const plans = data.plans || [];

    if (plans.length === 0) {
      console.log("No plans found. The API might have changed its format.");
      return;
    }

    const timestamp = new Date().toISOString();
    
    // Convert the "Brain" data into CSV rows
    const rows = plans.map(p => {
      const brand = p.providerName || "Unknown";
      const price = p.annualCost || 0;
      return `"${timestamp}","${brand}",${price}`;
    }).join('\n');

    // Save to the file
    if (!fs.existsSync('data.csv')) {
      fs.writeFileSync('data.csv', 'Timestamp,Brand,Price\n');
    }
    fs.appendFileSync('data.csv', rows + '\n');

    console.log(`Success! Saved ${plans.length} plans to data.csv`);

  } catch (error) {
    console.error('Scrape failed:', error.message);
    process.exit(1);
  }
}

scrape();
