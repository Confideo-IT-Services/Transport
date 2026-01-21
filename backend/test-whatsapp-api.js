require('dotenv').config();
const axios = require('axios');

async function testWhatsAppAPI() {
  const apiKey = process.env.WAZZAP_API_KEY;
  const apiUrl = process.env.WAZZAP_API_URL;
  const templateName = process.env.WAZZAP_TEMPLATE_NAME;
  const templateLanguage = process.env.WAZZAP_TEMPLATE_LANGUAGE;

  // Test phone number (India: 91 + 10 digits)
  const testPhone = '919603621014';

  // Test parameters matching your template
  const testParams = [
    'Test Student',                    // {{1}} - Student name
    'Monday, January 8, 2026',         // {{2}} - Date created
    'Mathematics: Test homework description', // {{3}} - Homework details
    '15 Jan 2026',                     // {{4}} - Due date
    'Test School'                      // {{5}} - School name
  ];

  console.log('🧪 Testing WhatsApp API...\n');
  console.log('API URL:', apiUrl);
  console.log('Template:', templateName);
  console.log('Language:', templateLanguage);
  console.log('Test Phone:', testPhone);
  console.log('Parameters:', testParams);
  console.log('\n' + '='.repeat(60) + '\n');

  // Try different formats
  const formats = [
    {
      name: 'Format 1: WhatsApp Business API Standard',
      endpoint: `${apiUrl}/messages`,
      payload: {
        messaging_product: "whatsapp",
        to: testPhone,
        type: "template",
        template: {
          name: templateName,
          language: { code: templateLanguage },
          components: [{
            type: "body",
            parameters: testParams.map(p => ({ type: "text", text: p }))
          }]
        }
      },
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    },
    {
      name: 'Format 2: Simple Template Format',
      endpoint: `${apiUrl}/api/send-template`,
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
      name: 'Format 3: API Key in Body',
      endpoint: `${apiUrl}/api/whatsapp/send-template`,
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
      name: 'Format 4: Alternative Endpoint',
      endpoint: `${apiUrl}/send-template`,
      payload: {
        to: testPhone,
        template: {
          name: templateName,
          language: templateLanguage,
          components: [{
            type: "body",
            parameters: testParams
          }]
        }
      },
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    },
    {
      name: 'Format 5: Direct API Call',
      endpoint: `${apiUrl}/api/whatsapp/send`,
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
      name: 'Format 6: With API Key Header',
      endpoint: `${apiUrl}/api/send-template`,
      payload: {
        phoneNumber: testPhone,
        templateName: templateName,
        language: templateLanguage,
        parameters: testParams
      },
      headers: {
        'X-API-Key': apiKey,
        'Content-Type': 'application/json'
      }
    }
  ];

  let successCount = 0;
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
      
      successCount++;
      if (!workingFormat) {
        workingFormat = format;
      }
      
      console.log('\n' + '='.repeat(60));
    } catch (error) {
      console.log('❌ Failed');
      if (error.response) {
        console.log('Status:', error.response.status);
        console.log('Error Data:', JSON.stringify(error.response.data, null, 2));
      } else if (error.request) {
        console.log('No response received. Error:', error.message);
      } else {
        console.log('Error:', error.message);
      }
      console.log('---');
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('\n📊 SUMMARY:');
  console.log(`✅ Successful formats: ${successCount}`);
  
  if (workingFormat) {
    console.log('\n✅ WORKING FORMAT FOUND:');
    console.log('Name:', workingFormat.name);
    console.log('Endpoint:', workingFormat.endpoint);
    console.log('\n📋 Use this payload format:');
    console.log(JSON.stringify(workingFormat.payload, null, 2));
    console.log('\n📋 Use these headers:');
    console.log(JSON.stringify(workingFormat.headers, null, 2));
  } else {
    console.log('\n❌ No working format found.');
    console.log('Please check:');
    console.log('1. API key is correct');
    console.log('2. Template name is correct and approved');
    console.log('3. Phone number format is correct');
    console.log('4. API URL is correct');
  }
  
  return { success: successCount > 0, format: workingFormat };
}

// Run the test
testWhatsAppAPI()
  .then(result => {
    if (result.success) {
      console.log('\n✅ Test completed successfully!');
      process.exit(0);
    } else {
      console.log('\n❌ Test failed. Check the errors above.');
      process.exit(1);
    }
  })
  .catch(error => {
    console.error('\n💥 Test crashed:', error.message);
    if (error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  });



