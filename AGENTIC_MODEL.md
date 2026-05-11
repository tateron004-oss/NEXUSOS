# NexusOS Agentic AI Model

NexusOS now includes an agentic workflow layer. Instead of one assistant generating one answer, NexusOS coordinates specialist agents that plan, execute tools, verify outputs, and save a run summary.

## Agent Team

- **Nexus Orchestrator**: plans and coordinates the workflow.
- **Intake Agent**: structures the client request.
- **Business Builder Agent**: creates the launch kit and client workspace.
- **Landing Page Agent**: creates the small-business landing page.
- **Assistant Studio Agent**: builds, tests, and packages the AI assistant.
- **Marketing Agent**: prepares social and outreach assets.
- **CRM Agent**: creates lead and follow-up structure.
- **Phone Agent**: prepares phone/SMS workflows.
- **QA Agent**: verifies key artifacts and summarizes next steps.

## Endpoint

```text
POST /api/agentic/run
```

This endpoint is protected by login.

## What It Creates

- Client workspace
- Website prototype
- Landing page
- AI assistant package
- Lead/follow-up/social/phone workflows
- QA artifact check
- Saved run summary

## Current Intelligence Mode

NexusOS now supports live LLM planning.

When `OPENAI_API_KEY` is configured, the Nexus Orchestrator asks the planner model to create the agent plan. The live planner returns structured JSON steps using the available specialist agents. NexusOS validates the plan, guarantees required business build and QA steps, executes the tools, and records the planning mode in the saved run summary.

When `OPENAI_API_KEY` is not configured, or if the live planner fails, NexusOS automatically falls back to deterministic planning.

Planning modes:

- `live-llm`: a live model created the plan.
- `deterministic`: no live model was configured.
- `deterministic-fallback`: a live model was configured but planning safely fell back.

## Next Upgrade

The next step is tool-by-tool LLM critique: after every specialist agent completes work, the orchestrator can ask the model to inspect the artifact, identify gaps, and decide whether to revise before final delivery.
