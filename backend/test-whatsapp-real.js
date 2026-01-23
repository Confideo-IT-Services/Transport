require('dotenv').config();
const { sendWhatsAppTemplateMessage } = require('./services/whatsappService');

async function testRealWhatsApp() {
  console.log('🧪 Testing Real WhatsApp API...\n');
  console.log('Environment Variables:');
  console.log('API URL:', process.env.WAZZAP_API_URL);
  console.log('API Version:', process.env.WAZZAP_API_VERSION);
  console.log('Phone Number ID:', process.env.WAZZAP_PHONE_NUMBER_ID);
  console.log('Template Name:', process.env.WAZZAP_TEMPLATE_NAME);
  console.log('Template Language:', process.env.WAZZAP_TEMPLATE_LANGUAGE);
  console.log('\n' + '='.repeat(60) + '\n');

  const testPhone = '919603621014';
  const testParams = [
    'Test Student',
    'Monday, January 8, 2026',
    'Mathematics: Test homework description',
    '15 Jan 2026',
    'Test School'
  ];

  try {
    const result = await sendWhatsAppTemplateMessage(
      testPhone,
      process.env.WAZZAP_TEMPLATE_NAME,
      process.env.WAZZAP_TEMPLATE_LANGUAGE,
      testParams
    );

    console.log('\n' + '='.repeat(60));
    console.log('\n📊 FINAL RESULT:');
    console.log('Success:', result.success);
    console.log('Message ID:', result.messageId);
    console.log('Error:', result.error);
    console.log('Error Code:', result.errorCode);
    console.log('Status Code:', result.statusCode);
    
    if (result.responseData) {
      console.log('\n📋 Full Response Data:');
      console.log(JSON.stringify(result.responseData, null, 2));
    }

    if (result.success) {
      console.log('\n✅ Test PASSED - Message should be sent!');
      console.log('Check your WhatsApp (9603621014) for the message.');
    } else {
      console.log('\n❌ Test FAILED - Message not sent');
      console.log('Error:', result.error);
    }
  } catch (error) {
    console.error('\n💥 Test crashed:', error);
    console.error(error.stack);
  }
}

testRealWhatsApp();





