-- =====================================================================
-- ShohojPay v4 — Admin Panel, Auto 1-Month/1-Year Billing & Unlimited Websites
-- Copy & Run ONCE in Supabase SQL Editor
-- =====================================================================

alter table public.merchants add column if not exists password_hash text;
alter table public.merchants add column if not exists plan_expires_at timestamptz;
alter table public.merchants add column if not exists is_owner boolean default false;

-- 1. Global Site Settings Table (Editable from /admin panel)
create table if not exists public.site_settings (
    id int primary key default 1,
    brand_name_en text default 'ShohojPay',
    brand_name_bn text default 'সহজপে',
    hero_title text default 'আপনার পার্সোনাল বা এজেন্ট bKash, Nagad, Rocket নাম্বারে টাকা নিন — অটো অ্যাপ্রুভ হবে!',
    support_phone text default '+880 1700-000000',
    apk_download_url text default 'https://github.com/freefireaivideo23372-wq/shohojpay-platform/releases',
    owner_bkash text default '01700-000000',
    owner_nagad text default '01800-000000',
    owner_rocket text default '01900-000000',
    owner_upay text default '01600-000000',
    price_starter_month int default 49,
    price_starter_year int default 399,
    price_pro_month int default 99,
    price_pro_year int default 799,
    price_lifetime int default 1499,
    updated_at timestamptz default now()
);

insert into public.site_settings (id) values (1) on conflict (id) do nothing;

-- 2. Unlimited Websites Table (For Owner & Pro/Lifetime Merchants)
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
