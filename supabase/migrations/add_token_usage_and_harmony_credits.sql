-- ============================================================
-- token_usage: Registro acumulativo de tokens consumidos por IA
-- Se mantiene independientemente de las conversaciones
-- (las conversaciones pueden borrarse, estos datos no)
-- ============================================================

create table if not exists public.token_usage (
  id uuid default gen_random_uuid() primary key,
  team_id uuid not null references public.teams(id) on delete cascade,
  agent_id uuid references public.ai_agents(id) on delete set null,
  agent_name text,
  provider text not null,
  model text not null,
  input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  conversation_id uuid,  -- nullable: referencia suave, conversación puede borrarse
  created_at timestamptz default now()
);

create index if not exists idx_token_usage_team_id on public.token_usage(team_id);
create index if not exists idx_token_usage_agent_id on public.token_usage(agent_id);
create index if not exists idx_token_usage_created_at on public.token_usage(created_at);

alter table public.token_usage enable row level security;

-- Solo miembros del equipo pueden leer; inserts los hace el service role del backend
create policy "Team members can view their token_usage"
  on public.token_usage for select
  using (
    team_id in (
      select team_id from public.profiles where id = auth.uid()
    )
  );

create policy "Service role can insert token_usage"
  on public.token_usage for insert
  with check (true);


-- ============================================================
-- harmony_credits: Saldo de créditos por equipo
-- El admin recarga desde otra plataforma vía service role
-- ============================================================

create table if not exists public.harmony_credits (
  id uuid default gen_random_uuid() primary key,
  team_id uuid not null references public.teams(id) on delete cascade unique,
  balance_usd numeric(10,4) not null default 0,          -- saldo actual en USD
  total_recharged_usd numeric(10,4) not null default 0,  -- acumulado histórico recargado
  updated_at timestamptz default now(),
  updated_by text  -- identificador del admin que hizo la recarga
);

alter table public.harmony_credits enable row level security;

-- Solo el gerente puede ver el saldo de su equipo
create policy "Gerente can view harmony_credits"
  on public.harmony_credits for select
  using (
    team_id in (
      select team_id from public.profiles
      where id = auth.uid() and role = 'gerente'
    )
  );

-- El service role gestiona recargas desde la plataforma de admin
create policy "Service role can manage harmony_credits"
  on public.harmony_credits for all
  using (true)
  with check (true);
