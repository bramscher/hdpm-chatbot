-- Add intake/workflow columns to rent_analyses so requests coming in from
-- the public hdpm-web form can be queued, reviewed, and delivered.

alter table rent_analyses
  add column if not exists status text not null default 'completed'
    check (status in ('requested', 'in_review', 'completed', 'delivered', 'declined')),
  add column if not exists source text not null default 'internal',
  add column if not exists source_app text,
  add column if not exists requested_by_lead_id integer,
  add column if not exists owner_phone text,
  add column if not exists requester_message text,
  add column if not exists requested_at timestamptz,
  add column if not exists delivered_at timestamptz;

-- Existing rows are completed analyses created internally; backfill keeps them
-- out of the "pending review" queue.
update rent_analyses
  set status = 'completed'
  where status is null;

create index if not exists idx_rent_analyses_status on rent_analyses(status);
create index if not exists idx_rent_analyses_requested_by_lead_id
  on rent_analyses(requested_by_lead_id);
