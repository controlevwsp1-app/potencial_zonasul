-- ============================================================
-- CARBANK · Carteira de Atendimento SP
-- Execute este SQL no Supabase → SQL Editor
-- ============================================================

-- 1. Criar tabela principal
create table if not exists lojas (
  id               bigserial primary key,
  cnpj             text not null,
  razao_social     text,
  bairro           text,
  cep              text,
  zona             text,
  micro_regiao     text,
  micro_regiao_nome text,
  porte            text,
  contratos_geral  integer default 0,
  volume_geral     numeric(15,2) default 0,
  contratos_carbank integer default 0,
  volume_carbank   numeric(15,2) default 0,
  status           text,
  colaboradora     text,
  ativo            boolean default true,
  criado_em        timestamptz default now(),
  atualizado_em    timestamptz default now()
);

-- 2. Índices para performance
create index if not exists idx_lojas_mr       on lojas(micro_regiao);
create index if not exists idx_lojas_zona     on lojas(zona);
create index if not exists idx_lojas_colab    on lojas(colaboradora);
create index if not exists idx_lojas_ativo    on lojas(ativo);

-- 3. Trigger para atualizar timestamp
create or replace function update_atualizado_em()
returns trigger as $$
begin
  new.atualizado_em = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_lojas_updated on lojas;
create trigger trg_lojas_updated
  before update on lojas
  for each row execute function update_atualizado_em();

-- 4. Habilitar RLS mas permitir acesso público (sem login)
alter table lojas enable row level security;

drop policy if exists "acesso_publico_leitura" on lojas;
create policy "acesso_publico_leitura"
  on lojas for select using (true);

drop policy if exists "acesso_publico_escrita" on lojas;
create policy "acesso_publico_escrita"
  on lojas for all using (true) with check (true);

-- 5. Verificar
select count(*) as total, micro_regiao, zona
from lojas
group by micro_regiao, zona
order by zona, micro_regiao;
