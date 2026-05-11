-- NexusOS hosted production schema baseline.
-- The current local app uses file persistence. Hosted SaaS should map these
-- entities to PostgreSQL using DATABASE_URL.

create table if not exists organizations (
  id uuid primary key,
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists users (
  id uuid primary key,
  organization_id uuid references organizations(id),
  email text not null unique,
  name text not null,
  role text not null check (role in ('owner', 'admin', 'staff', 'client')),
  password_hash text not null,
  created_at timestamptz not null default now()
);

create table if not exists clients (
  id uuid primary key,
  organization_id uuid not null references organizations(id),
  slug text not null,
  business_name text not null,
  workspace jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, slug)
);

create table if not exists outputs (
  id uuid primary key,
  organization_id uuid not null references organizations(id),
  client_id uuid references clients(id),
  title text not null,
  body text not null,
  created_by uuid references users(id),
  created_at timestamptz not null default now()
);

create table if not exists assistant_packages (
  id uuid primary key,
  client_id uuid not null references clients(id),
  config jsonb not null,
  system_prompt text not null,
  test_response text,
  created_at timestamptz not null default now()
);

create table if not exists audit_events (
  id uuid primary key,
  organization_id uuid references organizations(id),
  user_id uuid references users(id),
  action text not null,
  subject_type text not null,
  subject_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
