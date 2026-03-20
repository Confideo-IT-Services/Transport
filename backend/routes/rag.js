const express = require('express');
const axios = require('axios');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// PoC: `RAG_app` runs on the same machine (default port 8000).
// In production, this should be an internal URL (not public).
const RAG_API_URL = process.env.RAG_API_URL || 'http://localhost:8000';
const RAG_API_TIMEOUT_MS = Number(process.env.RAG_API_TIMEOUT_MS || 60000);
const RAG_ASK_URL = `${RAG_API_URL.replace(/\/$/, '')}/ask`;

router.post('/ask', authenticateToken, async (req, res) => {
  try {
    const userRole = req.user?.role;
    if (userRole !== 'admin' && userRole !== 'superadmin') {
      return res.status(403).json({ error: 'Forbidden: admin or superadmin only' });
    }

    const { question, conversationSummary } = req.body || {};
    if (!question || typeof question !== 'string') {
      return res.status(400).json({ error: 'question is required (string)' });
    }

    // Map ConventPulse roles -> RAG_app roles
    // - admin => school_admin (RAG_app role alias: "admin")
    // - superadmin => super_admin
    const ragPayload = {
      question,
      role: userRole === 'admin' ? 'admin' : 'superadmin',
    };

    if (userRole === 'admin') {
      if (!req.user?.schoolId) {
        return res.status(403).json({ error: 'Forbidden: school context missing' });
      }
      ragPayload.school_id = req.user.schoolId;
    }

    if (typeof conversationSummary === 'string') {
      ragPayload.conversation_summary = conversationSummary;
    }

    const ragResponse = await axios.post(RAG_ASK_URL, ragPayload, {
      timeout: RAG_API_TIMEOUT_MS,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Expected RAG_app response: { question, answer, new_conversation_summary?, error? }
    return res.json(ragResponse.data);
  } catch (error) {
    const status = error?.response?.status;
    const responseData = error?.response?.data;
    const code = error?.code;
    const syscall = error?.syscall;
    const message = error?.message;

    console.error('RAG proxy error:', {
      status,
      responseData,
      code,
      syscall,
      message,
      ragAskUrl: RAG_ASK_URL,
    });

    if (status) {
      return res.status(status).json(responseData || { error: 'RAG request failed' });
    }

    const detailsText = `No response from RAG_app at ${RAG_ASK_URL}. code=${code || "unknown"}, syscall=${syscall || "unknown"}, message=${message || "unknown"}`;
    return res.status(500).json({ error: 'RAG request failed', details: detailsText });
  }
});

module.exports = router;

