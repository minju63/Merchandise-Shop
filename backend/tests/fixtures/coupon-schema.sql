-- Minimal test schema from read-only production column metadata, 2026-11-02.
-- Intentionally excludes unrelated app tables; database tests use synthetic identities.
create role anon;
create role authenticated;
create role service_role bypassrls;
create schema auth;
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
grant usage on schema public,auth to anon,authenticated,service_role;
create table public.users(id uuid primary key,status text not null);
create table public.stores(id uuid primary key,name text);
create table public.products(id uuid primary key,status text not null default 'ON_SALE',open_at timestamptz);
create table public.cart_items (id uuid default gen_random_uuid() not null,user_id uuid not null,store_product_id uuid not null,fulfillment_type text not null,quantity int4 default 1 not null,is_selected bool default true not null,created_at timestamptz default now() not null,updated_at timestamptz default now() not null);
create table public.coupons (id uuid default gen_random_uuid() not null,store_id uuid,code varchar(30),name varchar not null,discount_type text not null,discount_value int4 not null,max_discount int4,min_order_amount int4 default 0 not null,applies_to text default 'ALL'::text not null,total_quantity int4,issued_count int4 default 0 not null,valid_from timestamptz not null,valid_until timestamptz not null,is_active bool default true not null,created_at timestamptz default now() not null);
create table public.inventory_logs (id uuid default gen_random_uuid() not null,store_product_id uuid not null,change_type text not null,quantity_delta int4 not null,stock_before int4 not null,stock_after int4 not null,order_id uuid,changed_by uuid,memo text,created_at timestamptz default now() not null);
create table public.order_items (id uuid default gen_random_uuid() not null,order_id uuid not null,store_product_id uuid not null,product_name varchar(200) not null,product_image_url varchar,condition_grade text default 'NEW'::text not null,unit_price int4 not null,quantity int4 not null,subtotal int4 not null,preorder_id uuid,created_at timestamptz default now() not null);
create table public.order_status_histories (id uuid default gen_random_uuid() not null,order_id uuid not null,from_status text,to_status text not null,changed_by uuid,memo text,created_at timestamptz default now() not null);
create table public.orders (id uuid default gen_random_uuid() not null,order_no varchar(30) not null,user_id uuid not null,store_id uuid not null,checkout_group_id uuid,fulfillment_type text not null,status text default 'PAID'::text not null,items_amount int4 not null,delivery_fee int4 default 0 not null,discount_amount int4 default 0 not null,total_amount int4 not null,commission_rate int4 not null,commission_amount int4 not null,used_coupon_id uuid,recipient_name varchar,recipient_phone varchar,shipping_address text,delivery_request text,tracking_no varchar,pickup_code varchar(30),pickup_deadline timestamptz,created_at timestamptz default now() not null,updated_at timestamptz default now() not null,canceled_at timestamptz,points_used_amount int4 default 0 not null,points_earn_amount int4 default 0 not null);
create table public.payments (id uuid default gen_random_uuid() not null,user_id uuid not null,purpose text not null,order_id uuid,preorder_id uuid,payment_method_id uuid,method_label varchar(50) not null,amount int4 not null,status text default 'PAID'::text not null,is_mock bool default true not null,pg_transaction_id varchar,approved_at timestamptz,canceled_at timestamptz,created_at timestamptz default now() not null);
create table public.point_transactions (id uuid default gen_random_uuid() not null,user_id uuid not null,order_id uuid,type text not null,status text default 'CONFIRMED'::text not null,amount int4 not null,memo text,created_at timestamptz default now() not null,kuji_ticket_id uuid);
create table public.store_products (id uuid default gen_random_uuid() not null,store_id uuid not null,product_id uuid not null,price int4 not null,discount_rate int4 default 0 not null,stock int4 default 0 not null,condition_grade text default 'NEW'::text not null,pickup_available bool default true not null,delivery_available bool default false not null,preorder_available bool default false not null,max_per_order int4,status text default 'ON_SALE'::text not null,restock_expected_at timestamptz,sales_count int4 default 0 not null,created_at timestamptz default now() not null,updated_at timestamptz default now() not null);
create table public.user_coupons (id uuid default gen_random_uuid() not null,user_id uuid not null,coupon_id uuid not null,status text default 'AVAILABLE'::text not null,expires_at timestamptz not null,used_at timestamptz,created_at timestamptz default now() not null);
alter table orders add primary key(id);
alter table coupons add primary key(id), add unique(code);
alter table user_coupons add primary key(id), add unique(user_id,coupon_id);
grant all on all tables in schema public to service_role;
grant execute on function auth.uid() to authenticated;

