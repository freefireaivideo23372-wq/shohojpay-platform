-- =======================================================================
-- ShohojPay v5 — Complete Setup (Pre-Configured for Owner & 01773895998)
-- Run ONCE in Supabase SQL Editor
-- =======================================================================

alter table public.merchants add column if not exists password_hash text;
alter table public.merchants add column if not exists plan_expires_at timestamptz;
alter table public.merchants add column if not exists is_owner boolean default false;

-- Pre-create / Upgrade Owner Account: khadizashuvo50@gmail.com (Lifetime Unlimited VIP)
insert into public.merchants (brand_name, email, password_hash, api_key, plan_name, plan_status, is_owner, plan_expires_at)
values (
    'ShohojPay Official',
    'khadizashuvo50@gmail.com',
    'b01190f8bc2a1a635aed8fe579cd41638f93fc5a0d6fb7a5cfc0004170b3ab1a',
    'sp_live_owner_98a72b41c65d89e01f23a45b',
    'Owner Lifetime Unlimited',
    'ACTIVE',
    true,
    '2099-12-31T23:59:59Z'
)
on conflict (email) do update set
    password_hash = excluded.password_hash,
    plan_name = 'Owner Lifetime Unlimited',
    plan_status = 'ACTIVE',
    is_owner = true,
    plan_expires_at = '2099-12-31T23:59:59Z';

-- Site Settings with Owner's Real Personal Number (01773895998 - Send Money)
create table if not exists public.site_settings (
    id int primary key default 1,
    brand_name_en text default 'ShohojPay',
    brand_name_bn text default 'সহজপে',
    hero_title text default 'আপনার পার্সোনাল বা এজেন্ট bKash, Nagad, Rocket নাম্বারে টাকা নিন — অটো অ্যাপ্রুভ হবে!',
    support_phone text default '01773895998',
    apk_download_url text default 'https://play.google.com/store/search?q=sms+forwarder+webhook&c=apps',
    owner_bkash text default '01773895998',
    owner_nagad text default '01773895998',
    owner_rocket text default '01773895998',
    owner_upay text default '01773895998',
    price_starter_month int default 49,
    price_starter_year int default 399,
    price_pro_month int default 99,
    price_pro_year int default 799,
    price_lifetime int default 1499,
    updated_at timestamptz default now()
);

insert into public.site_settings (id, support_phone, owner_bkash, owner_nagad, owner_rocket, owner_upay)
values (1, '01773895998', '01773895998', '01773895998', '01773895998', '01773895998')
on conflict (id) do update set
    support_phone = '01773895998',
    owner_bkash = '01773895998',
    owner_nagad = '01773895998',
    owner_rocket = '01773895998',
    owner_upay = '01773895998';

-- Clean sample wallets & set Owner's Personal 01773895998 for bKash, Nagad, Rocket
delete from public.wallets where phone_number in ('01715-889900', '01822-334455', '01933-4455668', '01644-556677', '01700-000000');

insert into public.wallets (gateway, account_type, phone_number, is_active) values
('bKash', 'Personal (Send Money)', '01773895998', true),
('Nagad', 'Personal (Send Money)', '01773895998', true),
('Rocket', 'Personal (Send Money)', '01773895998', true);

-- Unlimited Websites Table
create table if not exists public.merchant_websites (
    id uuid primary key default gen_random_uuid(),
    merchant_email text not null,
    site_name text not null,
    site_url text not null,
    site_api_key text unique not null,
    webhook_url text default '',
    is_active boolean default true,
    created_at timestamptz default now()
);

alter table public.site_settings enable row level security;
alter table public.merchant_websites enable row level security;
drop policy if exists "Public read site_settings" on public.site_settings;
create policy "Public read site_settings" on public.site_settings for select using (true);
drop policy if exists "Service all site_settings" on public.site_settings;
create policy "Service all site_settings" on public.site_settings for all using (true);
drop policy if exists "Service all merchant_websites" on public.merchant_websites;
create policy "Service all merchant_websites" on public.merchant_websites for all using (true);
