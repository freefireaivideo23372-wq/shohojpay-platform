-- Run ONCE in Supabase SQL Editor to add real password auth column & clear sample wallets
alter table public.merchants add column if not exists password_hash text;
delete from public.wallets where phone_number in ('01715-889900', '01822-334455', '01933-4455668', '01644-556677');
