require('dotenv').config();
const axios = require('axios');

async function discoverAPI() {
  const apiKey = process.env.WAZZAP_API_KEY;
  const apiUrl = process.env.WAZZAP_API_URL;

  console.log('🔍 Discovering API Structure...\n');
  console.log('Base URL:', apiUrl);
  console.log('\n' + '='.repeat(60) + '\n');

  // Try GET requests to common paths
  const paths = [
    '/',
    '/api',
    '/docs',
    '/health',
    '/status'
  ];

  for (const path of paths) {
    try {
      console.log(`\n🔄 Trying GET: ${apiUrl}${path}`);
      const response = await axios.get(`${apiUrl}${path}`, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 5000
      });
      console.log('✅ Response:', response.status);
      console.log('Data:', JSON.stringify(response.data, null, 2).substring(0, 500));
    } catch (error) {
      if (error.response) {
        console.log(`Status: ${error.response.status}`);
        if (error.response.status !== 404) {
          console.log('Response:', JSON.stringify(error.response.data, null, 2).substring(0, 500));
        }
      } else {
        console.log('Error:', error.message);
      }
    }
  }

  // Try POST to root with different payloads
  console.log('\n' + '='.repeat(60));
  console.log('\n🔄 Trying POST to root with different payloads...\n');

  const testPayloads = [
    {
      name: 'Payload 1: Simple',
      data: {
        apiKey: apiKey,
        action: 'send-template',
        phoneNumber: '919603621014',
        templateName: 'convent_pulse_hw',
        language: 'en_US',
        parameters: ['Test', 'Test', 'Test', 'Test', 'Test']
      }
    },
    {
      name: 'Payload 2: With type',
      data: {
        apiKey: apiKey,
        type: 'template',
        phoneNumber: '919603621014',
        templateName: 'convent_pulse_hw',
        language: 'en_US',
        parameters: ['Test', 'Test', 'Test', 'Test', 'Test']
      }
    }
  ];

  for (const payload of testPayloads) {
    try {
      console.log(`\n🔄 Trying: ${payload.name}`);
      const response = await axios.post(
        apiUrl,
        payload.data,
        {
          headers: {
            'Content-Type': 'application/json'
          },
          timeout: 10000
        }
      );
      console.log('✅ SUCCESS!');
      console.log('Status:', response.status);
      console.log('Response:', JSON.stringify(response.data, null, 2));
      break;
    } catch (error) {
      console.log('❌ Failed');
      if (error.response) {
        console.log('Status:', error.response.status);
        if (error.response.status !== 404) {
          console.log('Error:', JSON.stringify(error.response.data, null, 2).substring(0, 500));
        }
      } else {
        console.log('Error:', error.message);
      }
    }
  }
}

discoverAPI()
  .then(() => {
    console.log('\n✅ Discovery complete');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n💥 Error:', error.message);
    process.exit(1);
  });




