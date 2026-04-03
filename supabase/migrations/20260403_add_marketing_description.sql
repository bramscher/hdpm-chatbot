-- Add marketing_description column to cached_vacancies
-- Stores the human-written marketing description from AppFolio
alter table cached_vacancies
  add column if not exists marketing_description text not null default '';
