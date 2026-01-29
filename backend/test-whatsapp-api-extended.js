require('dotenv').config();
const axios = require('axios');

async function testWhatsAppAPI() {
  const apiKey = process.env.WAZZAP_API_KEY;
  const apiUrl = process.env.WAZZAP_API_URL;
  const templateName = process.env.WAZZAP_TEMPLATE_NAME;
  const templateLanguage = process.env.WAZZAP_TEMPLATE_LANGUAGE;

  const testPhone = '919603621014';
  const testParams = [
    'Test Student',
    'Monday, January 8, 2026',
    'Mathematics: Test homework description',
    '15 Jan 2026',
    'Test School'
  ];

  console.log('🧪 Testing Extended WhatsApp API Endpoints...\n');
  console.log('API URL:', apiUrl);
  console.log('Template:', templateName);
  console.log('Test Phone:', testPhone);
  console.log('\n' + '='.repeat(60) + '\n');

  // Extended list of possible endpoints
  const formats = [
    {
      name: 'Format A: /v1/send-template',
      endpoint: `${apiUrl}/v1/send-template`,
      payload: {
        phoneNumber: testPhone,
        templateName: templateName,
        language: templateLanguage,
        parameters: testParams
      },
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    },
    {
      name: 'Format B: /v1/whatsapp/send-template',
      endpoint: `${apiUrl}/v1/whatsapp/send-template`,
      payload: {
        phoneNumber: testPhone,
        templateName: templateName,
        language: templateLanguage,
        parameters: testParams
      },
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    },
    {
      name: 'Format C: /send with API key in body',
      endpoint: `${apiUrl}/send`,
      payload: {
        apiKey: apiKey,
        phoneNumber: testPhone,
        templateName: templateName,
        language: templateLanguage,
        parameters: testParams
      },
      headers: {
        'Content-Type': 'application/json'
      }
    },
    {
      name: 'Format D: /api/v1/send-template',
      endpoint: `${apiUrl}/api/v1/send-template`,
      payload: {
        phoneNumber: testPhone,
        templateName: templateName,
        language: templateLanguage,
        parameters: testParams
      },
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    },
    {
      name: 'Format E: /whatsapp/send-template',
      endpoint: `${apiUrl}/whatsapp/send-template`,
      payload: {
        phoneNumber: testPhone,
        templateName: templateName,
        language: templateLanguage,
        parameters: testParams
      },
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    },
    {
      name: 'Format F: Root with query params',
      endpoint: `${apiUrl}/?action=send-template`,
      payload: {
        apiKey: apiKey,
        phoneNumber: testPhone,
        templateName: templateName,
        language: templateLanguage,
        parameters: testParams
      },
      headers: {
        'Content-Type': 'application/json'
      }
    },
    {
      name: 'Format G: /send-template-message',
      endpoint: `${apiUrl}/send-template-message`,
      payload: {
        phoneNumber: testPhone,
        templateName: templateName,
        language: templateLanguage,
        parameters: testParams
      },
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    },
    {
      name: 'Format H: With apiKey as query param',
      endpoint: `${apiUrl}/send-template?apiKey=${apiKey}`,
      payload: {
        phoneNumber: testPhone,
        templateName: templateName,
        language: templateLanguage,
        parameters: testParams
      },
      headers: {
        'Content-Type': 'application/json'
      }
    }
  ];

  let workingFormat = null;

  for (const format of formats) {
    try {
      console.log(`\n🔄 Trying: ${format.name}`);
      console.log(`📍 Endpoint: ${format.endpoint}`);
      
      const response = await axios.post(
        format.endpoint,
        format.payload,
        {
          headers: format.headers,
          timeout: 10000
        }
      );

      console.log('✅ SUCCESS!');
      console.log('Status Code:', response.status);
      console.log('Response:', JSON.stringify(response.data, null, 2));
      
      workingFormat = format;
      console.log('\n' + '='.repeat(60));
      break; // Stop on first success
    } catch (error) {
      console.log('❌ Failed');
      if (error.response) {
        console.log('Status:', error.response.status);
        if (error.response.status !== 404) {
          console.log('Error Data:', JSON.stringify(error.response.data, null, 2));
        }
      } else if (error.request) {
        console.log('No response. Error:', error.message);
      } else {
        console.log('Error:', error.message);
      }
      console.log('---');
    }
  }

  if (workingFormat) {
    console.log('\n✅ WORKING FORMAT FOUND!');
    console.log('Name:', workingFormat.name);
    console.log('Endpoint:', workingFormat.endpoint);
    console.log('\n📋 Payload:');
    console.log(JSON.stringify(workingFormat.payload, null, 2));
    console.log('\n📋 Headers:');
    console.log(JSON.stringify(workingFormat.headers, null, 2));
  } else {
    console.log('\n❌ No working format found.');
    console.log('\n💡 Please check the Postman documentation and share:');
    console.log('1. The exact endpoint URL path');
    console.log('2. The request body structure');
    console.log('3. The headers required');
  }
  
  return { success: !!workingFormat, format: workingFormat };
}

testWhatsAppAPI()
  .then(result => {
    process.exit(result.success ? 0 : 1);
  })
  .catch(error => {
    console.error('\n💥 Test crashed:', error.message);
    process.exit(1);
  });







