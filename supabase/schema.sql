-- ==========================================================
-- ShohojPay (সহজপে) — Supabase PostgreSQL Schema & Realtime Setup
-- Run this inside Supabase SQL Editor (or via Antigravity CLI)
-- ==========================================================

create extension if not exists "pgcrypto";

-- 1. Merchants Table
create table if not exists public.merchants (
    id uuid primary key default gen_random_uuid(),
    brand_name text not null default 'ShohojPay',
    email text unique,
    api_key text unique not null default ('sp_live_' || encode(gen_random_bytes(12), 'hex')),
    bkash_number text default '01700000000',
    nagad_number text default '01800000000',
    rocket_number text default '01900000000',
    upay_number text default '01600000000',
    created_at timestamptz default now()
);

-- Insert Default Merchant Account
insert into public.merchants (brand_name, email, api_key, bkash_number, nagad_number, rocket_number, upay_number)
values ('ShohojPay', 'owner@shohojpay.com', 'sp_live_98a72b41c65d89e01f23a45b', '01715-889900', '01822-334455', '01933-4455668', '01644-556677')
on conflict (api_key) do nothing;

-- 2. Invoices Table (Customer Checkout Orders)
create table if not exists public.invoices (
    id uuid primary key default gen_random_uuid(),
    invoice_id text unique not null,
    order_id text not null,
    amount numeric(10,2) not null,
    customer_name text default 'Customer',
    customer_webhook_url text not null,
    customer_redirect_url text not null,
    gateway text,
    payment_type text, -- 'SEND_MONEY' or 'CASH_OUT'
    sender_phone text,
    trx_id text,
    status text not null default 'PENDING' check (status in ('PENDING', 'APPROVED', 'FAILED')),
    created_at timestamptz default now(),
    approved_at timestamptz
);

-- 3. SMS Logs Table (Incoming Messages from Android Phone Detector)
create table if not exists public.sms_logs (
    id uuid primary key default gen_random_uuid(),
    gateway text not null,
    payment_type text not null, -- 'SEND_MONEY' or 'CASH_OUT'
    amount numeric(10,2) not null,
    sender_phone text not null,
    trx_id text unique not null,
    raw_sms text not null,
    is_used boolean default false,
    matched_invoice_id text,
    received_at timestamptz default now()
);

-- Enable Row Level Security (RLS) with Public Read for Checkout Status & Service Role Write
alter table public.invoices enable row level security;
alter table public.sms_logs enable row level security;

create policy "Allow public read on invoices" on public.invoices for select using (true);
create policy "Allow service insert/update on invoices" on public.invoices for all using (true);
create policy "Allow service all on sms_logs" on public.sms_logs for all using (true);

-- Enable Supabase Realtime so Checkout Page auto-approves instantly without page reload!
alter publication supabase_realtime add table public.invoices;
alter publication supabase_realtime add table public.sms_logs;
