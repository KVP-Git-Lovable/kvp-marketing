-- Marketing journeys log sends against marketing_journey_enrollments, but journey_message_log.enrollment_id
-- was still tied to the retailer table journey_enrollments, so every marketing log insert failed silently.

-- 1) Remove the wrong foreign key.
alter table public.journey_message_log drop constraint if exists journey_message_log_enrollment_id_fkey;

-- 2) Re-create the 3 lost log rows for "KVP Marketing Test" (recipients confirmed they received the message).
insert into public.journey_message_log (journey_id, enrollment_id, contact_id, node_id, channel, status, created_at)
select e.journey_id, e.id, e.contact_id, e.current_node_id, 'whatsapp', 'delivered', e.enrolled_at + interval '4 seconds'
from public.marketing_journey_enrollments e
where e.journey_id = (select id from public.journeys where name = 'KVP Marketing Test' and deleted_at is null limit 1)
  and e.status = 'completed'
  and not exists (select 1 from public.journey_message_log l where l.enrollment_id = e.id);

-- 3) Attach the 3 orphan "sent" events to those rows (matched in time order).
with ev as (
  select id, row_number() over (order by occurred_at) rn from public.journey_message_events where journey_message_log_id is null
), lg as (
  select id, row_number() over (order by created_at, id) rn from public.journey_message_log
  where journey_id = (select id from public.journeys where name = 'KVP Marketing Test' and deleted_at is null limit 1)
)
update public.journey_message_events m set journey_message_log_id = lg.id
from ev join lg on lg.rn = ev.rn where m.id = ev.id;

select (select count(*) from public.journey_message_log) as logs,
       (select count(*) from public.journey_message_events where journey_message_log_id is null) as orphan_events;
