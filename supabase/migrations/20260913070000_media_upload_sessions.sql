create table if not exists public.media_upload_sessions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  user_id uuid not null,
  filename text not null,
  mime_type text not null,
  expected_byte_size bigint not null check (expected_byte_size > 0),
  expected_checksum_sha256 text not null check (expected_checksum_sha256 ~ '^[a-f0-9]{64}$'),
  chunk_count integer not null check (chunk_count between 1 and 10000),
  received_chunks integer not null default 0,
  received_bytes bigint not null default 0,
  status text not null default 'open' check (status in ('open','finalizing','completed','failed','expired')),
  asset_id uuid null,
  failure_code text null,
  expires_at timestamptz not null default (now() + interval '2 hours'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.media_upload_chunks (
  session_id uuid not null references public.media_upload_sessions(id) on delete cascade,
  tenant_id uuid not null,
  chunk_index integer not null check (chunk_index >= 0),
  byte_size integer not null check (byte_size > 0),
  checksum_sha256 text not null check (checksum_sha256 ~ '^[a-f0-9]{64}$'),
  storage_path text not null,
  created_at timestamptz not null default now(),
  primary key (session_id, chunk_index)
);

create index if not exists media_upload_sessions_tenant_status_idx
  on public.media_upload_sessions (tenant_id, status, created_at desc);
create index if not exists media_upload_chunks_tenant_session_idx
  on public.media_upload_chunks (tenant_id, session_id, chunk_index);

alter table public.media_upload_sessions enable row level security;
alter table public.media_upload_chunks enable row level security;

revoke all on public.media_upload_sessions from anon;
revoke all on public.media_upload_chunks from anon;
