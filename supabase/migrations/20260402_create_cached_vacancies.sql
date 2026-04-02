-- Cached vacancies from AppFolio
-- Persists pulled units so the list loads instantly; synced on each pull
create table if not exists cached_vacancies (
  appfolio_unit_id      text primary key,
  appfolio_property_id  text not null default '',
  address               text not null,
  city                  text not null,
  state                 text not null default 'OR',
  zip                   text not null default '',
  bedrooms              smallint not null default 0,
  bathrooms             real not null default 0,
  rent                  integer not null default 0,
  sqft                  integer not null default 0,
  available_date        text not null default '',
  unit_type             text not null default 'Rental',
  amenities             text[] not null default '{}',
  last_synced_at        timestamptz not null default now(),
  created_at            timestamptz not null default now()
);

create index if not exists idx_cached_vacancies_city on cached_vacancies(city);
create index if not exists idx_cached_vacancies_last_synced on cached_vacancies(last_synced_at);
