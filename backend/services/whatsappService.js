const axios = require('axios');
const templates = require('../config/whatsappTemplates');

/**
 * Send WhatsApp template message using Meta WhatsApp Cloud API (via 1automations.com)
 * Based on screenshot: API URL = https://crmapi.1automations.com/api/meta
 * API Version = v19.0, Phone Number ID = 964028530124571
 * 
 * Endpoint: POST https://crmapi.1automations.com/api/meta/v19.0/{PHONE_NUMBER_ID}/messages
 * 
 * @param {string} phoneNumber - Phone number with country code (no +)
 * @param {string} templateName - Approved template name (convent_pulse_hw)
 * @param {string} languageCode - Language code (en)
 * @param {Array<string>} templateParams - Array of 5 parameter values
 * @returns {Promise<Object>} API response
 */
async function sendWhatsAppTemplateMessage(phoneNumber, templateName, languageCode, templateParams = []) {
  try {
    const accessToken = process.env.WAZZAP_API_KEY;
    const phoneNumberId = process.env.WAZZAP_PHONE_NUMBER_ID;
    const apiBaseUrl = process.env.WAZZAP_API_URL || 'https://crmapi.1automations.com/api/meta';
    const apiVersion = process.env.WAZZAP_API_VERSION || 'v19.0';

    if (!accessToken) {
      throw new Error('WAZZAP_API_KEY (ACCESS_TOKEN) is not configured');
    }

    if (!phoneNumberId) {
      throw new Error('WAZZAP_PHONE_NUMBER_ID is not configured. Get it from Meta Business Manager.');
    }

    if (!templateName) {
      throw new Error('Template name is required');
    }

    // Parameter count validation removed - different templates have different counts
    // Validation is now done in sendWhatsAppMessage() based on template config

    // Format phone number (ensure it has country code, no +)
    let formattedPhone = phoneNumber.replace(/\D/g, '');
    // If it's 10 digits, assume India and add country code
    if (formattedPhone.length === 10) {
      formattedPhone = '91' + formattedPhone;
    }

    // Build endpoint - Meta WhatsApp Cloud API format via 1automations.com
    // Primary endpoint: https://crmapi.1automations.com/api/meta/v19.0/{PHONE_NUMBER_ID}/messages
    const endpoint = `${apiBaseUrl}/${apiVersion}/${phoneNumberId}/messages`;

    // Build payload exactly as per Meta's WhatsApp Cloud API format (via 1automations.com)
    const payload = {
      to: formattedPhone,
      recipient_type: "individual",
      type: "template",
      template: {
        name: templateName,
        language: {
          policy: "deterministic",
          code: languageCode || "en"
        },
        components: [
          {
            type: "body",
            parameters: templateParams.map(param => ({
              type: "text",
              text: String(param)
            }))
          }
        ]
      }
    };

    // Make the API call with exact Meta format
    // Log only in development mode
    if (process.env.NODE_ENV === 'development') {
      console.log('📤 Sending WhatsApp message:', {
        endpoint,
        phone: formattedPhone,
        template: templateName,
        paramsCount: templateParams.length
      });
    }

    const response = await axios.post(
      endpoint,
      payload,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      }
    );

    // Log the full response for debugging (only in development)
    if (process.env.NODE_ENV === 'development') {
      console.log('📥 WhatsApp API Response:', {
        status: response.status,
        statusText: response.statusText,
        data: JSON.stringify(response.data, null, 2)
      });
    }

    // Check if response has an error (even with 200 status)
    if (response.data?.error) {
      const apiError = response.data.error;
      console.error('❌ API returned error in response:', apiError);
      return {
        success: false,
        error: apiError.message || apiError.error_user_msg || 'API returned an error',
        errorCode: apiError.code,
        statusCode: response.status,
        responseData: response.data
      };
    }

    // 1automations.com API returns different format than standard Meta API
    // Check for 1automations.com response format: { message: { queue_id, message_status } }
    if (response.data?.message?.queue_id) {
      const queueId = response.data.message.queue_id;
      const messageStatus = response.data.message.message_status;
      
      // Log success (only in development)
      if (process.env.NODE_ENV === 'development') {
        console.log('✅ WhatsApp message queued successfully:', {
          queueId,
          status: messageStatus
        });
      }

      return {
        success: true,
        messageId: queueId, // Use queue_id as message identifier
        queueId: queueId,
        messageStatus: messageStatus,
        data: response.data
      };
    }

    // Standard Meta API format: check for messages[0].id
    const messageId = response.data?.messages?.[0]?.id || response.data?.id;
    if (messageId) {
      // Log success (only in development)
      if (process.env.NODE_ENV === 'development') {
        console.log('✅ WhatsApp message sent successfully, Message ID:', messageId);
      }
      return {
        success: true,
        messageId: messageId,
        queueId: messageId, // Use messageId as queueId for Meta format (for database logging)
        messageStatus: 'sent', // Meta format typically means message is sent
        data: response.data
      };
    }

    // If we get here, response format is unexpected
    console.warn('⚠️ Unexpected response format:', {
      responseKeys: Object.keys(response.data || {}),
      fullResponse: response.data
    });
    
    // If status is 200 and no error, assume success but log warning
    if (response.status === 200 && !response.data?.error) {
      console.warn('⚠️ Assuming success based on 200 status, but response format unexpected');
      return {
        success: true,
        messageId: response.data?.message?.queue_id || 'unknown',
        data: response.data
      };
    }

    return {
      success: false,
      error: 'Unexpected response format from API',
      responseData: response.data
    };

  } catch (error) {
    console.error('WhatsApp Template API Error:', {
      message: error.message,
      status: error.response?.status,
      data: error.response?.data,
      endpoint: error.config?.url
    });

    let errorMessage = 'Failed to send WhatsApp message';
    
    if (error.response?.data?.error) {
      const apiError = error.response.data.error;
      errorMessage = apiError.message || apiError.error_user_msg || errorMessage;
      
      // Handle specific Meta API error codes
      if (apiError.code === 132000) {
        errorMessage = 'Template not found or not approved';
      } else if (apiError.code === 131047) {
        errorMessage = 'Template parameter mismatch - check parameter count';
      } else if (apiError.code === 131026) {
        errorMessage = 'Phone number not registered on WhatsApp';
      } else if (apiError.code === 131031) {
        errorMessage = 'Message template not found';
      } else if (apiError.code === 190) {
        errorMessage = 'Invalid access token - check WAZZAP_API_KEY';
      } else if (apiError.code === 100) {
        errorMessage = 'Invalid parameter - check phone number or template name';
      }
    } else if (error.response?.data?.message) {
      errorMessage = error.response.data.message;
    } else if (error.message) {
      errorMessage = error.message;
    }

    return {
      success: false,
      error: errorMessage,
      errorCode: error.response?.data?.error?.code,
      statusCode: error.response?.status,
      responseData: error.response?.data
    };
  }
}

/**
 * Send WhatsApp message using template type from config
 * @param {string} phoneNumber - Phone number with country code
 * @param {string} messageType - Type from templates config (e.g., 'homework', 'attendance')
 * @param {Array<string>} templateParams - Parameters for the template
 * @param {Object} options - Additional options (templateName override, language override, etc.)
 * @returns {Promise<Object>} API response
 */
async function sendWhatsAppMessage(phoneNumber, messageType, templateParams = [], options = {}) {
  try {
    // Get template configuration
    const templateConfig = templates[messageType];
    
    if (!templateConfig) {
      throw new Error(`Template type '${messageType}' not found in configuration. Available types: ${Object.keys(templates).join(', ')}`);
    }

    // Get template name (use override if provided, otherwise from config)
    const templateName = options.templateName || templateConfig.templateName;
    const language = options.language || templateConfig.language || process.env.WAZZAP_TEMPLATE_LANGUAGE || 'en';
    
    // Validate parameter count
    if (templateParams.length !== templateConfig.paramCount) {
      throw new Error(
        `Template '${messageType}' requires ${templateConfig.paramCount} parameters, ` +
        `but ${templateParams.length} were provided. Parameters: ${JSON.stringify(templateParams)}`
      );
    }

    // Use the existing function with the resolved template name
    return await sendWhatsAppTemplateMessage(phoneNumber, templateName, language, templateParams);

  } catch (error) {
    console.error('WhatsApp Message Error:', error.message);
    return {
      success: false,
      error: error.message,
      errorCode: 'TEMPLATE_CONFIG_ERROR'
    };
  }
}

/**
 * Format phone number for WhatsApp (add country code if missing)
 */
function formatPhoneNumber(phone) {
  if (!phone) return null;
  
  // Remove all non-digit characters
  let cleaned = phone.replace(/\D/g, '');
  
  // If it's 10 digits, assume India and add country code
  if (cleaned.length === 10) {
    cleaned = '91' + cleaned;
  }
  
  return cleaned;
}

/**
 * Check WhatsApp message status using queue_id or message_id
 * Note: 1automations.com may not have a direct status endpoint
 * This function attempts multiple endpoint formats
 * @param {string} messageId - Queue ID or Message ID from send response
 * @returns {Promise<Object>} Status information
 */
async function checkWhatsAppMessageStatus(messageId) {
  try {
    const accessToken = process.env.WAZZAP_API_KEY;
    const phoneNumberId = process.env.WAZZAP_PHONE_NUMBER_ID;
    const apiBaseUrl = process.env.WAZZAP_API_URL || 'https://crmapi.1automations.com/api/meta';
    const apiVersion = process.env.WAZZAP_API_VERSION || 'v19.0';

    if (!accessToken || !phoneNumberId || !messageId) {
      throw new Error('Missing required configuration or message ID');
    }

    // Try different endpoint formats (1automations.com may have different structure)
    const endpoints = [
      `${apiBaseUrl}/${apiVersion}/${phoneNumberId}/messages/${messageId}`, // Standard Meta format
      `${apiBaseUrl}/${apiVersion}/messages/${messageId}`, // Alternative format
      `${apiBaseUrl}/messages/${messageId}/status`, // 1automations.com specific
      `${apiBaseUrl}/status/${messageId}` // Another possible format
    ];

    let lastError = null;
    for (const endpoint of endpoints) {
      try {
        const response = await axios.get(endpoint, {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          },
          timeout: 5000
        });

        if (response.data) {
          // Parse different response formats
          const status = response.data.status || 
                       response.data.message_status || 
                       response.data.message?.message_status ||
                       response.data.data?.status ||
                       'unknown';
          
          return {
            success: true,
            messageId: messageId,
            status: status,
            timestamp: response.data.timestamp || response.data.updated_at || new Date().toISOString(),
            data: response.data
          };
        }
      } catch (err) {
        // If 404, try next endpoint; if other error, log and continue
        if (err.response?.status !== 404) {
          if (process.env.NODE_ENV === 'development') {
            console.warn(`Status check endpoint failed: ${endpoint}`, err.message);
          }
        }
        lastError = err;
        continue;
      }
    }

    // If all endpoints failed, return error
    // Note: 1automations.com might not support status checking via API
    // In that case, status updates would come via webhooks
    return {
      success: false,
      error: 'Status check endpoint not available. Status updates may come via webhooks.',
      errorCode: 'ENDPOINT_NOT_FOUND'
    };

  } catch (error) {
    console.error('WhatsApp Status Check Error:', {
      message: error.message,
      status: error.response?.status,
      data: error.response?.data
    });

    return {
      success: false,
      error: error.response?.data?.error?.message || error.message || 'Failed to check message status',
      errorCode: error.response?.data?.error?.code,
      statusCode: error.response?.status
    };
  }
}

module.exports = {
  sendWhatsAppMessage, // New multi-template function
  sendWhatsAppTemplateMessage, // Old function for backward compatibility
  formatPhoneNumber,
  checkWhatsAppMessageStatus
};

