const fs = require('fs');

async function scrape() {
  // We use the Energy Made Easy / CDR public search endpoint
  // This is much more stable than Canstar's internal 'spark' API
  const ENDPOINT = 'https://cdr.energymadeeasy.gov.au/agl/cds-au/v1/energy/plans';
  
  console.log('Fetching live energy plans from official CDR endpoint...');

  try {
    const response = await fetch(ENDPOINT, {
      method: 'GET',
      headers: {
        'x-v': '3', // Mandatory version header for 2025 CDR standards
        'Content-Type': 'application/json',
        'User-Agent': 'Electricity-Tracker-Bot/1.0'
      }
    });

    if (!response.ok) {
      throw new Error(`Public API error: ${response.status}. They may require a specific retailer URI.`);
    }

    const data = await response.json();
    const plans = data.data?.plans || [];

    if (plans.length === 0) {
      console.log("No plans found in this specific retailer feed.");
      return;
    }

    const timestamp = new Date().toISOString();
    
    // The CDR format is slightly different: Brand is 'brand', Price is often in 'pricing'
    const rows = plans.map(p => {
      const brand = p.brand || "AGL"; // Example retailer
      const displayName = p.displayName || "Standard Plan";
      // Official APIs often provide rates; we'll log the plan name for now
      return `"${timestamp}","${brand} - ${displayName}",0`;
    }).join('\n');

    if (!fs.existsSync('data.csv')) {
      fs.writeFileSync('data.csv', 'Timestamp,Brand,Price\n');
    }
    fs.appendFileSync('data.csv', rows + '\n');

    console.log(`✓ Success! Captured ${plans.length} plans from the official registry.`);

  } catch (error) {
    console.error('❌ Scrape failed:', error.message);
    console.log('Note: We may need to rotate through specific Retailer URIs (Origin, Red, etc.)');
    process.exit(1);
  }
}

scrape();
