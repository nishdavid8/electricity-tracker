const fs = require('fs');

async function scrape() {
  // We are going to use a direct data fetch from a more 'open' source 
  // that provides Victorian energy data without the 406/404 errors.
  const URL = 'https://api.energymadeeasy.gov.au/plans/search'; 
  
  const payload = {
    postcode: "3000",
    fuelType: "electricity",
    customerType: "residential",
    count: 20
  };

  console.log('Fetching live energy plans for VIC 3000...');

  try {
    const response = await fetch(URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      },
      body: JSON.stringify(payload)
    });

    // If the Government API is being finicky, we provide a fallback message
    if (!response.ok) {
        throw new Error(`Connection Error: ${response.status}`);
    }

    const data = await response.json();
    // The data structure usually sits in 'results' or 'plans'
    const plans = data.results || data.plans || [];

    const timestamp = new Date().toISOString();
    
    const rows = plans.map(p => {
      const brand = p.brand || p.retailer || "Unknown Provider";
      const price = p.estimatedAnnualCost || p.annualPrice || 0;
      return `"${timestamp}","${brand}",${price}`;
    }).join('\n');

    if (rows.length > 0) {
        if (!fs.existsSync('data.csv')) {
            fs.writeFileSync('data.csv', 'Timestamp,Brand,Price\n');
        }
        fs.appendFileSync('data.csv', rows + '\n');
        console.log(`✓ Success! Recorded ${plans.length} plans.`);
    } else {
        console.log("No plans found in the response. Checking data format...");
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    // FALLBACK: To ensure you have data to work with for your dashboard, 
    // we can log a 'Heartbeat' entry if the API is down.
    const hb = `"${new Date().toISOString()}","System Check",0\n`;
    fs.appendFileSync('data.csv', hb);
    process.exit(1);
  }
}

scrape();
