const express = require('express');
const axios = require('axios');
const router = express.Router();

// In-memory store for verification tracking
// NOTE: This is for MAIN/dev environments only. In UAT/PROD, this MUST be replaced 
// with Redis (or similar distributed cache) with TTL expiry to handle multiple 
// server instances and ensure verification state persists across server restarts.
// Format: { phone: { verified: boolean, verifiedAt: timestamp, expiresAt: timestamp } }
// TTL: 10 minutes for verification state
const verificationStore = new Map();

// Rate limiting: max 3 OTP requests per phone per 15 minutes
const rateLimitStore = new Map();

// Clean up expired entries every 2 minutes
setInterval(() => {
  const now = Date.now();
  
  // Clean up expired verification states
  for (const [phone, data] of verificationStore.entries()) {
    if (data.expiresAt < now) {
      verificationStore.delete(phone);
    }
  }
  
  // Clean up expired rate limits
  for (const [phone, data] of rateLimitStore.entries()) {
    if (data.resetAt < now) {
      rateLimitStore.delete(phone);
    }
  }
}, 2 * 60 * 1000);

// Validate phone number format (Indian format)
function validatePhoneNumber(phone) {
  const cleaned = phone.replace(/\D/g, '');
  return cleaned.length === 10 && /^[6-9]\d{9}$/.test(cleaned);
}

// Format phone for MSG91 (add country code)
function formatPhoneForMSG91(phone) {
  const cleaned = phone.replace(/\D/g, '');
  return `91${cleaned}`;
}

// Send OTP via MSG91 OTP API
router.post('/send', async (req, res) => {
  try {
    const { mobile } = req.body;

    if (!mobile) {
      return res.status(400).json({ error: 'Mobile number is required' });
    }

    // Validate phone number
    if (!validatePhoneNumber(mobile)) {
      return res.status(400).json({ 
        error: 'Invalid mobile number format. Please enter a valid 10-digit Indian mobile number.' 
      });
    }

    const cleanedMobile = mobile.replace(/\D/g, '');
    
    // Read from environment variable (same variable name for all environments: MAIN, UAT, PROD)
    // Different values are injected via CI/CD secrets per environment
    const authKey = process.env.MSG91_OTP_AUTH_KEY;

    if (!authKey) {
      console.error('MSG91_OTP_AUTH_KEY not configured');
      return res.status(500).json({ error: 'OTP service not configured. Please contact administrator.' });
    }

    // Rate limiting: Check if phone has exceeded limit
    const now = Date.now();
    const rateLimitData = rateLimitStore.get(cleanedMobile);
    
    if (rateLimitData) {
      if (rateLimitData.resetAt > now) {
        if (rateLimitData.count >= 3) {
          const waitMinutes = Math.ceil((rateLimitData.resetAt - now) / 60000);
          return res.status(429).json({ 
            error: `Too many OTP requests. Please try again after ${waitMinutes} minute(s).` 
          });
        }
        rateLimitData.count += 1;
      } else {
        // Reset expired rate limit
        rateLimitStore.delete(cleanedMobile);
        rateLimitStore.set(cleanedMobile, { count: 1, resetAt: now + 15 * 60 * 1000 });
      }
    } else {
      rateLimitStore.set(cleanedMobile, { count: 1, resetAt: now + 15 * 60 * 1000 });
    }

    // Format phone for MSG91
    const formattedPhone = formatPhoneForMSG91(cleanedMobile);

    try {
      // MSG91 OTP Send API
      const response = await axios.get('https://api.msg91.com/api/v5/otp', {
        params: {
          authkey: authKey,
          mobile: formattedPhone,
          otp_length: 6,
          otp_expiry: 10, // 10 minutes
        },
        timeout: 10000, // 10 second timeout
      });

      // MSG91 returns different response formats based on success/error
      if (response.data && response.data.type === 'success') {
        // Initialize verification state (not storing OTP, only verification status)
        verificationStore.set(cleanedMobile, {
          verified: false,
          verifiedAt: null,
          expiresAt: now + 10 * 60 * 1000, // 10 minutes TTL
        });

        res.json({
          success: true,
          message: 'OTP sent successfully to your mobile number',
        });
      } else {
        // Handle MSG91 error response
        const errorMsg = response.data.message || response.data.Message || 'Failed to send OTP';
        throw new Error(errorMsg);
      }
    } catch (error) {
      console.error('MSG91 OTP Send API Error:', {
        status: error.response?.status,
        data: error.response?.data,
        message: error.message,
      });

      // Handle specific MSG91 error codes
      if (error.response?.data) {
        const msg91Error = error.response.data;
        
        // Handle rate limiting/throttling
        if (msg91Error.message?.includes('limit') || 
            msg91Error.message?.includes('throttle') ||
            msg91Error.message?.includes('too many')) {
          return res.status(429).json({ 
            error: 'Too many OTP requests. Please try again after some time.' 
          });
        }
        
        // Handle invalid auth key
        if (msg91Error.message?.includes('auth') || 
            msg91Error.message?.includes('invalid') ||
            error.response.status === 401) {
          console.error('MSG91 Authentication failed - check MSG91_OTP_AUTH_KEY');
          return res.status(500).json({ 
            error: 'OTP service configuration error. Please contact administrator.' 
          });
        }
        
        const errorMessage = msg91Error.message || msg91Error.Message || 'Failed to send OTP';
        return res.status(400).json({ error: errorMessage });
      }
      
      // Network/timeout errors
      if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
        return res.status(504).json({ 
          error: 'OTP service timeout. Please try again.' 
        });
      }
      
      return res.status(500).json({ 
        error: 'Failed to send OTP. Please try again.' 
      });
    }
  } catch (error) {
    console.error('Send OTP error:', error);
    res.status(500).json({ error: error.message || 'Failed to send OTP' });
  }
});

// Verify OTP
router.post('/verify', async (req, res) => {
  try {
    const { mobile, otp } = req.body;

    if (!mobile || !otp) {
      return res.status(400).json({ error: 'Mobile number and OTP are required' });
    }

    // Validate phone number
    if (!validatePhoneNumber(mobile)) {
      return res.status(400).json({ error: 'Invalid mobile number format' });
    }

    // Validate OTP format
    const cleanedOtp = otp.replace(/\D/g, '');
    if (cleanedOtp.length !== 6) {
      return res.status(400).json({ error: 'OTP must be 6 digits' });
    }

    const cleanedMobile = mobile.replace(/\D/g, '');
    
    // Read from environment variable (same variable name for all environments: MAIN, UAT, PROD)
    // Different values are injected via CI/CD secrets per environment
    const authKey = process.env.MSG91_OTP_AUTH_KEY;

    if (!authKey) {
      console.error('MSG91_OTP_AUTH_KEY not configured');
      return res.status(500).json({ error: 'OTP service not configured' });
    }

    // Get stored verification state
    const verificationData = verificationStore.get(cleanedMobile);
    if (!verificationData) {
      return res.status(400).json({ 
        error: 'OTP session not found. Please request a new OTP.' 
      });
    }

    // Check if verification state expired
    if (Date.now() > verificationData.expiresAt) {
      verificationStore.delete(cleanedMobile);
      return res.status(400).json({ 
        error: 'OTP session expired. Please request a new OTP.' 
      });
    }

    // Check if already verified (prevent multiple verifications)
    if (verificationData.verified) {
      return res.json({
        success: true,
        message: 'Mobile number already verified',
        verified: true,
      });
    }

    const formattedPhone = formatPhoneForMSG91(cleanedMobile);

    try {
      // MSG91 OTP Verify API
      const response = await axios.get('https://api.msg91.com/api/v5/otp/verify', {
        params: {
          authkey: authKey,
          mobile: formattedPhone,
          otp: cleanedOtp,
        },
        timeout: 10000,
      });

      // Check MSG91 response
      if (response.data && response.data.type === 'success') {
        // Mark as verified - store only verification status, not OTP
        verificationStore.set(cleanedMobile, {
          verified: true,
          verifiedAt: Date.now(),
          expiresAt: Date.now() + 10 * 60 * 1000, // 10 minutes TTL for verified state
        });

        res.json({
          success: true,
          message: 'Mobile number verified successfully',
          verified: true,
        });
      } else {
        // Invalid OTP
        const errorMsg = response.data.message || response.data.Message || 'Invalid OTP';
        return res.status(400).json({ error: errorMsg });
      }
    } catch (error) {
      console.error('MSG91 OTP Verify API Error:', {
        status: error.response?.status,
        data: error.response?.data,
        message: error.message,
      });

      if (error.response?.data) {
        const msg91Error = error.response.data;
        
        // Handle invalid OTP
        if (error.response.status === 400 || 
            msg91Error.message?.includes('invalid') ||
            msg91Error.message?.includes('incorrect')) {
          return res.status(400).json({ 
            error: 'Invalid OTP. Please check and try again.' 
          });
        }
        
        // Handle expired OTP
        if (msg91Error.message?.includes('expired') || 
            msg91Error.message?.includes('timeout')) {
          verificationStore.delete(cleanedMobile);
          return res.status(400).json({ 
            error: 'OTP has expired. Please request a new OTP.' 
          });
        }
        
        const errorMessage = msg91Error.message || msg91Error.Message || 'Failed to verify OTP';
        return res.status(400).json({ error: errorMessage });
      }
      
      return res.status(500).json({ 
        error: 'Failed to verify OTP. Please try again.' 
      });
    }
  } catch (error) {
    console.error('Verify OTP error:', error);
    res.status(500).json({ error: error.message || 'Failed to verify OTP' });
  }
});

// Resend OTP
router.post('/resend', async (req, res) => {
  try {
    const { mobile } = req.body;

    if (!mobile) {
      return res.status(400).json({ error: 'Mobile number is required' });
    }

    // Validate phone number
    if (!validatePhoneNumber(mobile)) {
      return res.status(400).json({ error: 'Invalid mobile number format' });
    }

    const cleanedMobile = mobile.replace(/\D/g, '');
    
    // Read from environment variable (same variable name for all environments: MAIN, UAT, PROD)
    // Different values are injected via CI/CD secrets per environment
    const authKey = process.env.MSG91_OTP_AUTH_KEY;

    if (!authKey) {
      console.error('MSG91_OTP_AUTH_KEY not configured');
      return res.status(500).json({ error: 'OTP service not configured' });
    }

    // Check rate limiting
    const now = Date.now();
    const rateLimitData = rateLimitStore.get(cleanedMobile);
    
    if (rateLimitData && rateLimitData.resetAt > now) {
      if (rateLimitData.count >= 3) {
        const waitMinutes = Math.ceil((rateLimitData.resetAt - now) / 60000);
        return res.status(429).json({ 
          error: `Too many OTP requests. Please try again after ${waitMinutes} minute(s).` 
        });
      }
      rateLimitData.count += 1;
    } else {
      rateLimitStore.set(cleanedMobile, { count: 1, resetAt: now + 15 * 60 * 1000 });
    }

    const formattedPhone = formatPhoneForMSG91(cleanedMobile);

    try {
      // MSG91 OTP Resend API (retry)
      const response = await axios.get('https://api.msg91.com/api/v5/otp/retry', {
        params: {
          authkey: authKey,
          mobile: formattedPhone,
          retrytype: 'text', // text or voice
        },
        timeout: 10000,
      });

      if (response.data && response.data.type === 'success') {
        // Reset verification state (not storing OTP)
        verificationStore.set(cleanedMobile, {
          verified: false,
          verifiedAt: null,
          expiresAt: now + 10 * 60 * 1000, // 10 minutes TTL
        });

        res.json({
          success: true,
          message: 'OTP resent successfully',
        });
      } else {
        const errorMsg = response.data.message || response.data.Message || 'Failed to resend OTP';
        throw new Error(errorMsg);
      }
    } catch (error) {
      console.error('MSG91 OTP Resend API Error:', {
        status: error.response?.status,
        data: error.response?.data,
        message: error.message,
      });

      if (error.response?.data) {
        const msg91Error = error.response.data;
        
        if (msg91Error.message?.includes('limit') || 
            msg91Error.message?.includes('throttle')) {
          return res.status(429).json({ 
            error: 'Too many OTP requests. Please try again after some time.' 
          });
        }
        
        const errorMessage = msg91Error.message || msg91Error.Message || 'Failed to resend OTP';
        return res.status(400).json({ error: errorMessage });
      }
      
      return res.status(500).json({ 
        error: 'Failed to resend OTP. Please try again.' 
      });
    }
  } catch (error) {
    console.error('Resend OTP error:', error);
    res.status(500).json({ error: error.message || 'Failed to resend OTP' });
  }
});

module.exports = router;

