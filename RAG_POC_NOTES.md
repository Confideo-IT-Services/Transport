# RAG Integration PoC Notes (ConventPulse)

## Scope / Goal
Integrate the existing `RAG_app` (FastAPI + Bedrock text-to-SQL) into ConventPulse so:
- `school_admin` (role `admin` in ConventPulse) can query only their `school_id`
- `super_admin` (role `superadmin`) can query across all schools
- chat supports multi-turn UX via **conversation summary + latest question** (single request per turn)

## Current security posture (important)
- `RAG_app` currently exposes `POST /ask` without authentication.
- `RAG_app` relies on the caller-supplied `role` + `school_id` to scope results.
- Therefore, for PoC we will **only expose** `RAG_app` to the ConventPulse backend (network-level restriction / firewall), and expose only the ConventPulse API endpoint to the frontend.

## Hosting options: same machine (PoC) vs production (future)

### Option 1: Same machine (PoC)
Run `RAG_app` on the same host as the Node/React app, and keep its port private.

Pros
- Fastest setup for iteration/testing
- Lowest incremental infrastructure cost
- No extra network hops between services

Cons
- Operational coupling: if `RAG_app` is slow/unhealthy, ConventPulse requests may also slow
- Scaling: independent scaling is harder
- Security is more “manual” (must ensure only the backend can reach the RAG port)

Mitigations we will do in PoC (and improve later)
- Make ConventPulse backend the only caller of `RAG_app`
- Use short HTTP timeouts on the backend -> `RAG_app`
- Block inbound access to the `RAG_app` port at firewall / reverse proxy level
- Remove open CORS exposure from the public internet later (production)

### Option 2: AWS ECS (recommended for production)
Run `RAG_app` as its own ECS service behind an internal ALB/NLB, with security groups permitting only backend -> RAG.

Pros
- Service isolation + independent scaling
- Cleaner deployment/rollback boundary
- Network security boundaries are more explicit (security groups)

Cons
- Additional AWS cost (ECS tasks, load balancer if used)
- Requires CI/CD/deployment work

### Option 3: Separate server (EC2 / on-prem)

Pros
- Stronger isolation than same machine

Cons
- Ops overhead (patching, monitoring, scaling)
- Network/security hardening is manual

## Memory strategy: summary + latest question (single flow)

### Why summary?
If we send full chat history every turn, token usage grows roughly linearly with conversation length.
With **rolling summary**, the prompt stays bounded and cost becomes mostly “per turn baseline”, not “per turn + history size”.

### What we mean by “single flow”
For each user turn:
1. Frontend sends `conversation_summary` + `latest_question` to ConventPulse backend.
2. Backend forwards to `RAG_app`.
3. `RAG_app` returns:
   - `answer` (for the user)
   - `new_conversation_summary` (updated summary for next turn)

So the UI uses the updated summary for the next request, without a separate LLM call for summarization.

### Cost drivers (relative)
- Baseline cost per turn remains (schema + tool usage inside `RAG_app`).
- Rolling summary avoids adding large historical transcripts to the prompt each turn.
- The incremental cost of maintaining summary should be minor compared to the repeated schema/tool context.

## Chat UI choice: full page vs floating widget

### Option A: Dedicated full page (what we implement in PoC)
Pros
- Works reliably on mobile (small screens need vertical space)
- Easy to implement and test table rendering
- Future extensibility: you can later open it as a modal while preserving the same component

Cons
- Takes up more navigation space on desktop (but can be acceptable for admin tools)

### Option B: Floating widget / panel (possible later)
Pros
- Compact for desktop workflows
- Can be reused across multiple pages

Cons
- Mobile UX can degrade (tiny screens + persistent overlays)
- More UI state complexity (scrolling, resizing, z-index)

### Best approach for future scaling
Implement the chat as a **reusable component** that can render in:
- `variant="page"` now
- `variant="modal"` or `variant="widget"` later

This keeps the component logic stable while allowing UX to evolve without rewriting the integration.

## Testing plan (manual, PoC)
- Login as `admin` for School A, ask a query referencing school data -> verify only School A returns.
- Login as `admin` for School B, ask same query -> results should differ.
- Login as `superadmin`, ask same query -> results can include both schools.
- Ask a query that returns multiple rows -> verify UI formats it as a table (Markdown table parsing).
- Do 3-5 follow-ups referencing earlier context -> verify summary enables correct interpretation.

## PoC runbook (same machine)
1. Start `RAG_app` (FastAPI)
   - Run from `F:/Repo/ConventPulse/RAG_app`:
     - `uvicorn app.main:app --host 0.0.0.0 --port 8000`
     - or `python run_server.py`
2. Start ConventPulse backend (Node)
   - Run `F:/Repo/ConventPulse/backend`:
     - `npm install`
     - `npm start`
3. Configure backend env (if needed)
   - Ensure `RAG_API_URL` points to `http://localhost:8000` (default is already this value in the PoC code).
4. Start the frontend
   - Run `F:/Repo/ConventPulse`:
     - `npm install`
     - `npm run dev`
5. Login
   - School admin: visit `/dashboard/chatbot`
   - Super admin: visit `/superadmin/chatbot`

## Operational next steps for production (future)
- Add rate limiting and request quotas for chatbot endpoint.
- Add authentication/authorization boundaries so `RAG_app` cannot be called directly.
- Improve logging/auditing for chatbot queries.
- Add robust multi-turn retrieval memory (optional) and/or per-user/session memory persistence.

