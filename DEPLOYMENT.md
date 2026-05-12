# NexusOS Hosted Deployment

## Minimum Hosted Environment

- Node.js 20+ or Docker
- HTTPS web host
- Persistent disk or PostgreSQL database
- Environment variables from `.env.example`

## Required Secrets

- `NEXUSOS_ADMIN_EMAIL`
- `NEXUSOS_ADMIN_PASSWORD`
- `NEXUSOS_REQUIRE_LIVE_SERVICES=true`

## Live Service Secrets

- `OPENAI_API_KEY`
- `OPENAI_MODEL`
- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_PHONE_NUMBER`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`

## Persistence

The included Render blueprint uses a persistent disk:

- `NEXUSOS_DATA_DIR=/var/data/data`
- `NEXUSOS_WORKSPACE_DIR=/var/data/workspace`

For a database-backed SaaS, also set:

- `DATABASE_URL`

## Stripe Webhook

Create a Stripe webhook endpoint pointing to:

```text
https://YOUR-RENDER-URL/api/stripe/webhook
```

Subscribe to:

```text
checkout.session.completed
```

Copy the webhook signing secret into:

```text
STRIPE_WEBHOOK_SECRET
```

## Render Blueprint

`render.yaml` is included as a starting point. Before going public, set all secret values in the Render dashboard, then run:

```text
GET /api/readiness
```

`ok` means the runtime is healthy. `productionReady` means the core SaaS is ready. `liveIntegrationsReady` means database, AI, and phone/SMS credentials are all configured.

The Render blueprint mounts a persistent disk at `/var/data` and stores NexusOS data/workspaces there:

```text
NEXUSOS_DATA_DIR=/var/data/data
NEXUSOS_WORKSPACE_DIR=/var/data/workspace
```

## Verification Commands

```powershell
npm.cmd run check
npm.cmd run smoke
npm.cmd run browser:regression
```

For a hosted URL:

```powershell
$env:NEXUSOS_URL="https://your-hosted-url"
npm.cmd run smoke
npm.cmd run browser:regression
```
