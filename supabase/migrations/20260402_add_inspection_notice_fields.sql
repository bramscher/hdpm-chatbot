-- Inspection notice automation tracking
-- Tracks which automated notifications have been sent for each inspection
alter table inspections
  add column if not exists notice_meld_id    text,          -- PM meld ID created for notice
  add column if not exists notice_7d_sent_at timestamptz,   -- 7-day notice sent
  add column if not exists notice_24h_sent_at timestamptz,  -- 24-hour reminder sent
  add column if not exists notice_2h_sent_at timestamptz;   -- 2-hour reminder sent

create index if not exists idx_inspections_notice_pending
  on inspections (target_date)
  where status = 'scheduled'
    and target_date is not null;
