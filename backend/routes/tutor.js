const express = require('express');
const axios = require('axios');
const db = require('../config/database');
const multer = require('multer');
const FormData = require('form-data');
const { authenticateToken, requireSuperAdmin } = require('../middleware/auth');

const router = express.Router();

const RAG_API_URL = process.env.RAG_API_URL || 'http://localhost:8000';
// Tutor ingestion can take a while (PDF->text->chunk->embeddings->FAISS).
// Default bumped from 60s to 15 minutes to avoid timeouts on larger books.
const RAG_API_TIMEOUT_MS = Number(process.env.RAG_API_TIMEOUT_MS || 15 * 60 * 1000);
const TUTOR_ASK_URL = `${RAG_API_URL.replace(/\/$/, '')}/tutor/ask`;
const TUTOR_INGEST_URL = `${RAG_API_URL.replace(/\/$/, '')}/tutor/ingest`;

const uploadPdfFiles = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: Number(process.env.TUTOR_PDF_MAX_BYTES || 25 * 1024 * 1024), // 25MB each
  },
});

// Simple in-memory cache: schoolId -> { board, expiresAt }
const boardCache = new Map();
const BOARD_CACHE_TTL_MS = Number(process.env.BOARD_CACHE_TTL_MS || 10 * 60 * 1000); // 10 minutes

async function getBoardForSchool(schoolId) {
  const now = Date.now();
  const cached = boardCache.get(schoolId);
  if (cached && cached.expiresAt > now && cached.board) return cached.board;

  let board = 'state_board';
  try {
    const [rows] = await db.query('SELECT board FROM schools WHERE id = ? LIMIT 1', [schoolId]);
    board = rows?.[0]?.board || 'state_board';
  } catch (e) {
    // If the DB migration adding `schools.board` hasn't been applied yet,
    // MySQL will throw ER_BAD_FIELD_ERROR: Unknown column 'board' ...
    console.warn('Tutor ingest: schools.board column missing or unreadable; defaulting board', {
      schoolId,
      code: e?.code,
      message: e?.message,
    });
  }

  boardCache.set(schoolId, { board, expiresAt: now + BOARD_CACHE_TTL_MS });
  return board;
}

router.post('/ask', authenticateToken, async (req, res) => {
  try {
    const userRole = req.user?.role;
    if (userRole !== 'teacher' && userRole !== 'parent') {
      return res.status(403).json({ error: 'Forbidden: teacher/parent only' });
    }

    const schoolId = req.user?.schoolId;
    if (!schoolId) {
      return res.status(403).json({ error: 'Forbidden: school context missing' });
    }

    const { question, classLevel, subject, topic, conversationSummary } = req.body || {};

    if (!question || typeof question !== 'string') {
      return res.status(400).json({ error: 'question is required (string)' });
    }
    if (!classLevel || !subject) {
      return res.status(400).json({ error: 'classLevel and subject are required' });
    }

    const board = await getBoardForSchool(schoolId);

    const topicStr = typeof topic === 'string' ? topic : '';

    const ragPayload = {
      question,
      school_id: schoolId,
      board,
      class_level: classLevel,
      subject,
      topic: topicStr,
      conversation_summary: typeof conversationSummary === 'string' ? conversationSummary : null,
    };

    const ragResponse = await axios.post(TUTOR_ASK_URL, ragPayload, {
      timeout: RAG_API_TIMEOUT_MS,
      headers: { 'Content-Type': 'application/json' },
    });

    return res.json(ragResponse.data);
  } catch (error) {
    const status = error?.response?.status;
    const responseData = error?.response?.data;
    const code = error?.code;
    const syscall = error?.syscall;
    const message = error?.message;

    console.error('Tutor proxy error:', {
      status,
      responseData,
      code,
      syscall,
      message,
      tutorAskUrl: TUTOR_ASK_URL,
    });

    if (status) {
      return res.status(status).json(responseData || { error: 'Tutor request failed' });
    }

    return res.status(500).json({
      error: 'Tutor request failed',
      details: `No response from tutor service at ${TUTOR_ASK_URL}. code=${code || 'unknown'}, message=${message || 'unknown'}`,
    });
  }
});

// Super Admin: upload Tutor syllabus PDFs -> build/update FAISS index
router.post(
  '/ingest',
  authenticateToken,
  requireSuperAdmin,
  uploadPdfFiles.array('pdfFiles', 50),
  async (req, res) => {
    try {
      const { schoolId, classLevel, subject, topic, resetIndex } = req.body || {};

      if (!schoolId || !classLevel || !subject) {
        return res.status(400).json({ error: 'schoolId, classLevel and subject are required' });
      }

      const schoolBoard = await getBoardForSchool(schoolId);

      const pdfFiles = Array.isArray(req.files) ? req.files : [];
      if (pdfFiles.length === 0) {
        return res.status(400).json({ error: 'At least one PDF file (field `pdfFiles`) is required' });
      }

      const topicStr = typeof topic === 'string' ? topic : '';
      const resetEnabled = ['1', 'true', 'yes', 'y'].includes(
        String(resetIndex || 'false').toLowerCase(),
      );
      const form = new FormData();

      form.append('school_id', String(schoolId));
      form.append('board', String(schoolBoard));
      form.append('class_level', String(classLevel));
      form.append('subject', String(subject));
      // Topic optional: empty string means no topic filtering later during retrieval.
      form.append('topic', topicStr);
      form.append('reset_index', resetEnabled ? 'true' : 'false');

      for (const f of pdfFiles) {
        form.append('pdf_files', f.buffer, {
          filename: f.originalname || 'upload.pdf',
          contentType: f.mimetype || 'application/pdf',
        });
      }

      const ragResponse = await axios.post(TUTOR_INGEST_URL, form, {
        timeout: RAG_API_TIMEOUT_MS,
        headers: form.getHeaders(),
        maxBodyLength: Infinity,
      });

      return res.json(ragResponse.data);
    } catch (error) {
      const status = error?.response?.status;
      const responseData = error?.response?.data;
      const code = error?.code;
      const syscall = error?.syscall;
      const message = error?.message;

      console.error('Tutor ingest proxy error:', {
        status,
        responseData,
        code,
        syscall,
        message,
        tutorIngestUrl: TUTOR_INGEST_URL,
      });

      if (status) {
        return res.status(status).json(responseData || { error: 'Tutor ingest failed' });
      }

      return res.status(500).json({
        error: 'Tutor ingest failed',
        details: `No response from tutor ingest service at ${TUTOR_INGEST_URL}. code=${code || 'unknown'}, message=${message || 'unknown'}`,
      });
    }
  }
);

module.exports = router;

