-- Saved rent analysis reports
-- Stores the full analysis JSON + metadata for listing, reprinting, and editing
create table if not exists rent_analyses (
  id            uuid primary key default gen_random_uuid(),
  address       text not null,
  town          text not null,
  bedrooms      smallint not null,
  bathrooms     real,
  sqft          integer,
  property_type text not null default 'SFR',

  -- Rent recommendation (what ends up on the PDF)
  recommended_rent_low   integer not null,
  recommended_rent_mid   integer not null,
  recommended_rent_high  integer not null,
  recommended_rent_override integer,  -- manual override, null if not used

  -- Owner personalization
  prepared_for  text,
  owner_email   text,

  -- The full analysis payload (for reprinting / editing)
  analysis_json jsonb not null,

  -- PDF storage
  pdf_file_path text,          -- path in Supabase Storage bucket
  short_url     text,          -- shareable short link

  -- Metadata
  created_by    text not null,  -- user email
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Index for listing by user and date
create index if not exists idx_rent_analyses_created_by on rent_analyses(created_by);
create index if not exists idx_rent_analyses_town on rent_analyses(town);
create index if not exists idx_rent_analyses_created_at on rent_analyses(created_at desc);

-- Auto-update updated_at
create or replace function update_rent_analyses_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger rent_analyses_updated_at
  before update on rent_analyses
  for each row
  execute function update_rent_analyses_updated_at();
