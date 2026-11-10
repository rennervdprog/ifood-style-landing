-- Fase 3 dos tutoriais (2026-11-10): a conclusão das lições da Escola de
-- Parceiros passa a morar no servidor (antes era só localStorage, por
-- aparelho — sumia ao trocar de celular e ninguém media nada).
-- Uma linha por (usuário, lição concluída). O painel faz merge com o
-- cache local ao abrir e grava nos dois lugares ao marcar/desmarcar.

create table if not exists public.tutorial_progress (
  user_id uuid not null references auth.users (id) on delete cascade,
  section_id text not null,
  completed_at timestamptz not null default now(),
  primary key (user_id, section_id)
);

alter table public.tutorial_progress enable row level security;

drop policy if exists "tutorial_progress_select_own" on public.tutorial_progress;
create policy "tutorial_progress_select_own"
  on public.tutorial_progress for select
  using (auth.uid() = user_id);

drop policy if exists "tutorial_progress_insert_own" on public.tutorial_progress;
create policy "tutorial_progress_insert_own"
  on public.tutorial_progress for insert
  with check (auth.uid() = user_id);

drop policy if exists "tutorial_progress_delete_own" on public.tutorial_progress;
create policy "tutorial_progress_delete_own"
  on public.tutorial_progress for delete
  using (auth.uid() = user_id);
