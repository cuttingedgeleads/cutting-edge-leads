const https = require('https');
const fs = require('fs');
const path = require('path');

// Load environment variables from .env.production
const envPath = path.join(__dirname, '.env.production');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const match = line.match(/^([^=:#]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      let value = match[2].trim();
      // Remove quotes if present
      if ((value.startsWith('"') && value.endsWith('"')) || 
          (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      process.env[key] = value;
    }
  });
}

const RESEND_API_KEY = process.env.RESEND_API_KEY;

if (!RESEND_API_KEY) {
  console.error('Error: RESEND_API_KEY not found in environment');
  console.error('Please set the RESEND_API_KEY environment variable');
  process.exit(1);
}

console.log('API Key found:', RESEND_API_KEY ? `${RESEND_API_KEY.substring(0, 10)}...` : 'MISSING');
console.log('');

// Function to make HTTPS request
function makeRequest(options, data = null) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          resolve({ statusCode: res.statusCode, headers: res.headers, body: parsed });
        } catch (e) {
          resolve({ statusCode: res.statusCode, headers: res.headers, body });
        }
      });
    });

    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

async function addDomain() {
  console.log('Step 1: Adding domain to Resend...');
  
  const data = JSON.stringify({ name: 'cuttingedgeleads.net' });
  
  const options = {
    hostname: 'api.resend.com',
    port: 443,
    path: '/domains',
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
      'Content-Length': data.length
    }
  };

  try {
    const response = await makeRequest(options, data);
    console.log('Response:', JSON.stringify(response.body, null, 2));
    
    if (response.statusCode === 200 || response.statusCode === 201) {
      console.log('\n✓ Domain added successfully!');
      return response.body;
    } else {
      console.error('\n✗ Failed to add domain');
      return null;
    }
  } catch (error) {
    console.error('Error:', error.message);
    return null;
  }
}

async function listDomains() {
  console.log('Checking existing domains...');
  
  const options = {
    hostname: 'api.resend.com',
    port: 443,
    path: '/domains',
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${RESEND_API_KEY}`
    }
  };

  try {
    const response = await makeRequest(options);
    console.log('Existing domains:', JSON.stringify(response.body, null, 2));
    return response.body;
  } catch (error) {
    console.error('Error listing domains:', error.message);
    return null;
  }
}

async function verifyDomain(domainId) {
  console.log(`\nStep 3: Verifying domain ${domainId}...`);
  
  const options = {
    hostname: 'api.resend.com',
    port: 443,
    path: `/domains/${domainId}/verify`,
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json'
    }
  };

  try {
    const response = await makeRequest(options, '{}');
    console.log('Verification response:', JSON.stringify(response.body, null, 2));
    return response.body;
  } catch (error) {
    console.error('Error verifying domain:', error.message);
    return null;
  }
}

async function main() {
  console.log('=== Resend Domain Verification ===\n');
  
  // First check if domain already exists
  const domains = await listDomains();
  let domainData = null;
  
  if (domains && domains.data) {
    const existing = domains.data.find(d => d.name === 'cuttingedgeleads.net');
    if (existing) {
      console.log('\n✓ Domain already exists in Resend');
      domainData = existing;
    }
  }
  
  // If not exists, add it
  if (!domainData) {
    domainData = await addDomain();
  }
  
  if (domainData) {
    console.log('\n=== DNS Records Required ===');
    console.log(JSON.stringify(domainData, null, 2));
    
    console.log('\n=== Next Steps ===');
    console.log('1. Add the following DNS records to Vercel:');
    if (domainData.records) {
      domainData.records.forEach((record, i) => {
        console.log(`\n   Record ${i + 1}:`);
        console.log(`   Type: ${record.type}`);
        console.log(`   Name: ${record.name}`);
        console.log(`   Value: ${record.value}`);
        if (record.priority) console.log(`   Priority: ${record.priority}`);
      });
    }
    
    console.log('\n2. After adding DNS records, you can verify with:');
    console.log(`   node verify-resend-domain.js verify ${domainData.id}`);
    
    // If verification was requested
    if (process.argv.includes('verify') && domainData.id) {
      await verifyDomain(domainData.id);
    }
  }
}

main().catch(console.error);

