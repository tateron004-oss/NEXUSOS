# NexusOS Command App

NexusOS is a local AI services operating system for building and managing small-business client workspaces.

## Run

```powershell
cd C:\Users\tater\Documents\Codex\2026-05-04\good-morning-coach\CoachOS_App
npm start
```

Open:

```text
http://127.0.0.1:4288
```

Public intake:

```text
http://127.0.0.1:4288/intake.html
```

Pricing/subscriptions:

```text
http://127.0.0.1:4288/pricing.html
```

Live service status:

```text
http://127.0.0.1:4288/status.html
```

## Core Workflows

- Sign in with secure local admin credentials.
- Share `/intake.html` so friends, family, or clients can request help.
- Public intake automatically creates a client workspace, landing page, assistant package, phone workflow, and admin follow-up note.
- Share `/pricing.html` to demo subscription tiers and create subscriber portals.
- Subscribers can sign in to `/subscriber.html` with email and generated temporary password.
- Use `/status.html` to verify whether OpenAI, Stripe, Twilio, and persistence are truly connected.
- Run an agentic AI workflow that coordinates specialist agents across intake, business build, landing pages, assistant studio, marketing, CRM, phone, and QA.
- Create a full client business kit.
- Open a client workspace.
- Edit leads, social posts, assistant scripts, tasks, and landing page copy.
- Generate small-business landing pages.
- Build, test, and package a client AI assistant in AI Assistant Studio.
- Save command briefs and generated workflow outputs locally.

## Agentic Model

See `AGENTIC_MODEL.md` for the NexusOS agent team and orchestration model.

## Production Readiness

Health:

```text
GET /api/healthz
```

Readiness:

```text
GET /api/readiness
```

## Default Local Login

```text
Email: admin@nexusos.local
Password: nexusos-admin
```

Set `NEXUSOS_ADMIN_EMAIL` and `NEXUSOS_ADMIN_PASSWORD` before first hosted launch.

## Live Services

- `OPENAI_API_KEY` turns on live assistant testing.
- `OPENAI_PLANNER_MODEL` controls live LLM planning for the Nexus Orchestrator.
- `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, and `TWILIO_PHONE_NUMBER` turn on live SMS sending.
- `DATABASE_URL` identifies the hosted PostgreSQL target. The baseline schema is in `database.schema.sql`.
- `STRIPE_SECRET_KEY` prepares live billing. Without it, NexusOS runs in demo subscription mode.
- `STRIPE_WEBHOOK_SECRET` is reserved for webhook verification; current local smoke tests use unsigned demo events.

Without these credentials, NexusOS uses local file persistence, simulated assistant replies, and simulated SMS mode.

## Readiness Meaning

`productionReady` means the core SaaS app is healthy: auth, workspace, outputs, clients, and public app shell are available.

`liveIntegrationsReady` means external services are fully configured: hosted database, live AI, and phone/SMS provider.

This lets NexusOS be production-ready as a core SaaS while clearly showing whether live integrations are active or running in safe fallback mode.

Set `NEXUSOS_REQUIRE_LIVE_SERVICES=true` after adding real OpenAI, Stripe, and Twilio credentials if you want dependent workflows to fail loudly instead of using fallback behavior.
