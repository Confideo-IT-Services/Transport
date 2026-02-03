const db = require('../config/database');

/**
 * Check if WhatsApp is enabled for a specific feature in a school
 * @param {string} schoolId - School ID
 * @param {string} feature - Feature name (homework, attendance, fees, notifications, reports, timetable)
 * @returns {Promise<boolean>} - True if WhatsApp is enabled for the feature
 */
async function isWhatsAppEnabledForFeature(schoolId, feature) {
  try {
    if (!schoolId || !feature) {
      return false;
    }

    const [settings] = await db.query(
      'SELECT whatsapp_enabled, whatsapp_features FROM school_settings WHERE school_id = ?',
      [schoolId]
    );

    if (settings.length === 0) {
      // No settings found, default to disabled
      return false;
    }

    const setting = settings[0];
    
    // Check if WhatsApp is globally enabled
    if (!setting.whatsapp_enabled) {
      return false;
    }

    // Parse features JSON
    let features = {};
    if (setting.whatsapp_features) {
      features = typeof setting.whatsapp_features === 'string'
        ? JSON.parse(setting.whatsapp_features)
        : setting.whatsapp_features;
    }

    // Check if the specific feature is enabled
    return features[feature] === true;
  } catch (error) {
    console.error('Error checking WhatsApp feature:', error);
    return false;
  }
}

/**
 * Get all WhatsApp settings for a school
 * @param {string} schoolId - School ID
 * @returns {Promise<Object>} - Settings object with whatsappEnabled and features
 */
async function getWhatsAppSettings(schoolId) {
  try {
    if (!schoolId) {
      return {
        whatsappEnabled: false,
        features: {
          homework: false,
          attendance: false,
          fees: false,
          notifications: false,
          reports: false,
          timetable: false
        }
      };
    }

    const [settings] = await db.query(
      'SELECT whatsapp_enabled, whatsapp_features FROM school_settings WHERE school_id = ?',
      [schoolId]
    );

    if (settings.length === 0) {
      return {
        whatsappEnabled: false,
        features: {
          homework: false,
          attendance: false,
          fees: false,
          notifications: false,
          reports: false,
          timetable: false
        }
      };
    }

    const setting = settings[0];
    const features = setting.whatsapp_features 
      ? (typeof setting.whatsapp_features === 'string' 
          ? JSON.parse(setting.whatsapp_features) 
          : setting.whatsapp_features)
      : {
          homework: false,
          attendance: false,
          fees: false,
          notifications: false,
          reports: false,
          timetable: false
        };

    return {
      whatsappEnabled: !!setting.whatsapp_enabled,
      features: features
    };
  } catch (error) {
    console.error('Error getting WhatsApp settings:', error);
    return {
      whatsappEnabled: false,
      features: {
        homework: false,
        attendance: false,
        fees: false,
        notifications: false,
        reports: false,
        timetable: false
      }
    };
  }
}

module.exports = {
  isWhatsAppEnabledForFeature,
  getWhatsAppSettings
};

