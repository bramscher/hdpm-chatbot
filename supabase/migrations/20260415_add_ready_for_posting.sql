-- Extend cached_vacancies to cache ALL units so the search box can find
-- anything in AppFolio, not just marketable ones. `ready_for_posting` flags
-- whether the unit meets Craigslist criteria (vacant or on-notice + rent ready).
create extension if not exists pg_trgm;

alter table cached_vacancies
  add column if not exists ready_for_posting boolean not null default false,
  add column if not exists status_reason text not null default '';

create index if not exists idx_cached_vacancies_ready on cached_vacancies(ready_for_posting);
create index if not exists idx_cached_vacancies_address_trgm on cached_vacancies using gin (address gin_trgm_ops);
