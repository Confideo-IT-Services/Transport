# AGENTS.md — ConventPulse (AllPulse)

Instructions for coding agents working in this repository: **stack, layout, and how to keep changes scoped.**

## Product context

ConventPulse is a **school / operations management** web app (dashboards, students, fees, attendance, notifications, WhatsApp hooks, visitor flows, ID cards, parent portal, super admin, optional RAG chatbot). Treat it as a **multi-tenant** system: respect existing `school_id` / auth patterns on the backend.

## Tech stack

| Layer | Technology |
|-------|------------|
| Frontend | Vite 5, React 18, TypeScript, Tailwind CSS, Radix UI primitives, TanStack React Query, React Router v6, react-hook-form + zod |
| HTTP client | `fetch`; base URL `import.meta.env.VITE_API_URL` (defaults in code often assume `http://localhost:3000/api`) — see `src/lib/api.ts` |
| Backend | Node.js, Express 4, `mysql2` → MySQL, `jsonwebtoken`, `bcryptjs`, `cors`, `dotenv` |
| Files / integrations | `@aws-sdk/client-s3`, `multer`, `sharp`, `pdfkit`, `axios` |
| RAG microservice | Python 3.11, FastAPI, Uvicorn, LangChain + FAISS + related deps — `RAG_app/` (deployed separately; backend may proxy via `/api/rag`, `/api/tutor`) |

Do **not** introduce a new framework or database for routine features unless the user explicitly asks.

## Repository map

```
src/                    # React SPA
  pages/                # Route-level screens (dashboard/, parent/, superadmin/, register/, …)
  components/           # Shared UI (incl. ui/ shadcn-style)
  contexts/             # e.g. AuthProvider
  lib/api.ts            # Central API helpers — extend here when adding endpoints
backend/
  server.js             # Express app + route mounting — add `app.use` for new routers
  routes/               # One file per domain (auth, students, fees, whatsapp, …)
  middleware/           # auth, etc.
  config/database.js    # MySQL pool
  utils/                # query-builder, audit, services
  jobs/                 # Optional cron/interval workers
RAG_app/                # FastAPI app (not Express)
```

## Scoped change rules

1. **Only modify what the request requires.** Avoid unrelated files, “cleanup,” or cosmetic churn outside the touched feature.
2. **Backend feature** → usually `backend/routes/<domain>.js`, sometimes `backend/utils/` or `backend/services`, and **`backend/server.js`** only to mount a new router.
3. **Frontend feature** → relevant `src/pages/...` and/or `src/components/...`; if the UI calls new endpoints, add functions in **`src/lib/api.ts`**.
4. **Shared contracts** → keep request/response shapes aligned between Express handlers and `api.ts` callers.
5. **Database** → if migrations/scripts exist in the repo, use the project’s existing convention; otherwise document new columns/tables in the PR/summary for the maintainer.
6. **RAG-only work** → confine to `RAG_app/` unless the user also needs proxy/UI changes.

## Route files (backend) — quick index

Use this to find the right file for a domain; **do not edit every file** when only one domain changes.

| Domain | File |
|--------|------|
| Auth | `backend/routes/auth.js` |
| Schools | `backend/routes/schools.js` |
| Teachers | `backend/routes/teachers.js` |
| Classes | `backend/routes/classes.js` |
| Students | `backend/routes/students.js` |
| Homework | `backend/routes/homework.js` |
| School admins | `backend/routes/schoolAdmins.js` |
| Registration links | `backend/routes/registrationLinks.js` |
| Uploads | `backend/routes/upload.js` |
| Timetable | `backend/routes/timetable.js` |
| Attendance | `backend/routes/attendance.js` |
| Tests | `backend/routes/tests.js` |
| Academic years | `backend/routes/academicYears.js` |
| Fees | `backend/routes/fees.js` |
| ID templates / generation | `backend/routes/idCardTemplates.js`, `idCardGeneration.js` |
| OTP | `backend/routes/otp.js` |
| Notifications | `backend/routes/notifications.js` |
| WhatsApp | `backend/routes/whatsapp.js` |
| Parents | `backend/routes/parents.js` |
| Visitor requests | `backend/routes/visitorRequests.js` |
| Tutor / ingest | `backend/routes/tutor.js` |
| RAG proxy | `backend/routes/rag.js` |

## Security reminders

- New authenticated routes should use **`authenticateToken`** and respect **`school_id`** isolation like sibling routes.
- See comments at the top of `backend/server.js` and `backend/SECURITY_GUIDE.md` if present.

## Local dev (reference)

- Frontend: `npm run dev` (Vite; port may be 8080 per `vite.config.ts`).
- Backend: `npm run dev` in `backend/` (nodemon, port from `PORT` or 3000).
- RAG: see `RAG_app/README` or `run_server.py` / Docker as documented there.

---

When in doubt, **read the nearest existing feature** (same domain) and mirror its patterns instead of inventing new ones.
