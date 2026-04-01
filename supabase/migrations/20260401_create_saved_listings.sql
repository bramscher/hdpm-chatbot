-- Saved Craigslist listing runs
-- Stores generated listing copy + unit data for history and re-use
create table if not exists saved_listings (
  id                uuid primary key default gen_random_uuid(),
  appfolio_unit_id  text not null,
  address           text not null,
  city              text not null,
  state             text not null default 'OR',
  zip               text,
  bedrooms          smallint not null,
  bathrooms         real,
  sqft              integer,
  monthly_rent      integer not null,
  unit_type         text,
  amenities         text[],
  available_date    text,

  -- Generated listing content
  listing_title     text not null,
  listing_body      text not null,
  rently_enabled    boolean not null default false,
  rently_url        text,

  -- Metadata
  created_by        text not null,  -- user email
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists idx_saved_listings_created_by on saved_listings(created_by);
create index if not exists idx_saved_listings_address on saved_listings(address);
create index if not exists idx_saved_listings_created_at on saved_listings(created_at desc);

-- Auto-update updated_at
create or replace function update_saved_listings_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger saved_listings_updated_at
  before update on saved_listings
  for each row
  execute function update_saved_listings_updated_at();
