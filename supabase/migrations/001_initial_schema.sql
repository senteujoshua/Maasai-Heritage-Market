-- ============================================================
-- MAASAI HERITAGE MARKET — DATABASE SCHEMA
-- ============================================================

create extension if not exists "uuid-ossp";

-- ============================================================
-- ENUMS
-- ============================================================
create type user_role           as enum ('buyer', 'seller', 'admin');
create type verification_status as enum ('not_submitted', 'pending', 'approved', 'rejected');
create type listing_type        as enum ('fixed', 'auction');
create type listing_status      as enum ('draft', 'pending_approval', 'active', 'sold', 'ended', 'rejected');
create type payment_method      as enum ('mpesa', 'card', 'cod');
create type payment_status      as enum ('pending', 'awaiting_payment', 'completed', 'failed', 'refunded');
create type order_status        as enum ('pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded');

-- ============================================================
-- PROFILES
-- ============================================================
create table profiles (
  id                   uuid references auth.users on delete cascade primary key,
  email                text unique not null,
  full_name            text not null,
  phone                text,
  location             text,
  region               text,
  avatar_url           text,
  bio                  text,
  role                 user_role not null default 'buyer',
  -- Seller fields
  shop_name            text,
  shop_description     text,
  is_verified          boolean default false,
  verification_status  verification_status default 'not_submitted',
  national_id_url      text,
  kra_pin_url          text,
  rejection_reason     text,
  -- Stats
  rating               numeric(3,2) default 0.00,
  total_sales          integer default 0,
  total_reviews        integer default 0,
  -- Timestamps
  created_at           timestamptz default now(),
  updated_at           timestamptz default now()
);

alter table profiles enable row level security;
create policy "Public profiles are viewable by everyone"
  on profiles for select using (true);
create policy "Users can insert their own profile"
  on profiles for insert with check (auth.uid() = id);
create policy "Users can update their own profile"
  on profiles for update using (auth.uid() = id);
create policy "Admins can update any profile"
  on profiles for update using (
    exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );

-- ============================================================
-- CATEGORIES
-- ============================================================
create table categories (
  id          uuid default uuid_generate_v4() primary key,
  name        text not null,
  slug        text unique not null,
  description text,
  icon        text,
  image_url   text,
  parent_id   uuid references categories(id),
  sort_order  integer default 0,
  created_at  timestamptz default now()
);

alter table categories enable row level security;
create policy "Categories are viewable by everyone"
  on categories for select using (true);
create policy "Only admins can modify categories"
  on categories for all using (
    exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );

-- Seed categories
insert into categories (name, slug, description, sort_order) values
  ('Drawings & Art',    'drawings-art',    'Original paintings, prints, and drawings',               1),
  ('Beaded Jewelry',    'beaded-jewelry',  'Handcrafted beaded necklaces, bracelets, and earrings',  2),
  ('Attire & Clothing', 'attire-clothing', 'Traditional and fusion Maasai fashion',                  3),
  ('Shukas & Textiles', 'shukas-textiles', 'Authentic Maasai shukas and woven textiles',             4),
  ('Cultural Tools',    'cultural-tools',  'Traditional instruments, tools, and artifacts',          5),
  ('Home Décor',        'home-decor',      'African-inspired home decoration pieces',                6);

-- ============================================================
-- LISTINGS
-- ============================================================
create table listings (
  id                       uuid default uuid_generate_v4() primary key,
  seller_id                uuid references profiles(id) on delete cascade not null,
  category_id              uuid references categories(id),
  title                    text not null,
  description              text not null,
  cultural_story           text,
  listing_type             listing_type not null default 'fixed',
  price                    numeric(12,2),
  -- Auction fields
  auction_start_time       timestamptz,
  auction_end_time         timestamptz,
  auction_duration_hours   integer,
  starting_bid             numeric(12,2),
  current_bid              numeric(12,2),
  current_bidder_id        uuid references profiles(id),
  bid_count                integer default 0,
  -- Meta
  status                   listing_status not null default 'draft',
  is_approved              boolean default false,
  rejection_reason         text,
  region                   text,
  stock_quantity           integer default 1,
  shipping_details         text,
  estimated_shipping_days  integer,
  tags                     text[],
  views                    integer default 0,
  -- Timestamps
  created_at               timestamptz default now(),
  updated_at               timestamptz default now()
);

create index listings_seller_id_idx        on listings(seller_id);
create index listings_category_id_idx      on listings(category_id);
create index listings_status_idx           on listings(status);
create index listings_listing_type_idx     on listings(listing_type);
create index listings_is_approved_idx      on listings(is_approved);
create index listings_auction_end_time_idx on listings(auction_end_time) where listing_type = 'auction';

alter table listings enable row level security;
create policy "Active approved listings viewable by everyone"
  on listings for select using (
    (status = 'active' and is_approved = true)
    or seller_id = auth.uid()
    or exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );
create policy "Sellers can create listings"
  on listings for insert with check (
    auth.uid() = seller_id and
    exists (select 1 from profiles where id = auth.uid() and role in ('seller', 'admin'))
  );
create policy "Sellers can update their own listings"
  on listings for update using (
    auth.uid() = seller_id or
    exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );
create policy "Sellers can delete their own listings"
  on listings for delete using (
    auth.uid() = seller_id or
    exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );

-- ============================================================
-- LISTING IMAGES
-- ============================================================
create table listing_images (
  id            uuid default uuid_generate_v4() primary key,
  listing_id    uuid references listings(id) on delete cascade not null,
  image_url     text not null,
  is_primary    boolean default false,
  display_order integer default 0,
  created_at    timestamptz default now()
);

create index listing_images_listing_id_idx on listing_images(listing_id);

alter table listing_images enable row level security;
create policy "Listing images viewable by everyone"
  on listing_images for select using (true);
create policy "Sellers can manage their listing images"
  on listing_images for all using (
    exists (select 1 from listings where id = listing_id and seller_id = auth.uid()) or
    exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );

-- ============================================================
-- BIDS
-- ============================================================
create table bids (
  id          uuid default uuid_generate_v4() primary key,
  listing_id  uuid references listings(id) on delete cascade not null,
  bidder_id   uuid references profiles(id) on delete cascade not null,
  amount      numeric(12,2) not null,
  is_winning  boolean default false,
  created_at  timestamptz default now()
);

create index bids_listing_id_idx on bids(listing_id);
create index bids_bidder_id_idx  on bids(bidder_id);
create index bids_is_winning_idx on bids(is_winning) where is_winning = true;

alter table bids enable row level security;
create policy "Bids viewable by everyone"
  on bids for select using (true);
create policy "Authenticated users can place bids"
  on bids for insert with check (
    auth.uid() = bidder_id and
    exists (select 1 from profiles where id = auth.uid())
  );

-- ============================================================
-- CART
-- ============================================================
create table cart_items (
  id          uuid default uuid_generate_v4() primary key,
  user_id     uuid references profiles(id) on delete cascade not null,
  listing_id  uuid references listings(id) on delete cascade not null,
  quantity    integer not null default 1,
  created_at  timestamptz default now(),
  unique(user_id, listing_id)
);

alter table cart_items enable row level security;
create policy "Users can manage their own cart"
  on cart_items for all using (auth.uid() = user_id);

-- ============================================================
-- WISHLISTS
-- ============================================================
create table wishlist_items (
  id          uuid default uuid_generate_v4() primary key,
  user_id     uuid references profiles(id) on delete cascade not null,
  listing_id  uuid references listings(id) on delete cascade not null,
  created_at  timestamptz default now(),
  unique(user_id, listing_id)
);

alter table wishlist_items enable row level security;
create policy "Users can manage their own wishlist"
  on wishlist_items for all using (auth.uid() = user_id);
create policy "Wishlist counts viewable by everyone"
  on wishlist_items for select using (true);

-- ============================================================
-- ORDERS
-- ============================================================
create table orders (
  id                        text primary key,
  buyer_id                  uuid references profiles(id) not null,
  items                     jsonb not null default '[]',
  subtotal                  numeric(12,2) not null,
  delivery_fee              numeric(12,2) default 350,
  total                     numeric(12,2) not null,
  payment_method            payment_method not null,
  payment_status            payment_status default 'pending',
  status                    order_status default 'pending',
  shipping_address          jsonb,
  mpesa_checkout_request_id text,
  mpesa_receipt_number      text,
  failure_reason            text,
  paid_at                   timestamptz,
  shipped_at                timestamptz,
  delivered_at              timestamptz,
  created_at                timestamptz default now(),
  updated_at                timestamptz default now()
);

create index orders_buyer_id_idx      on orders(buyer_id);
create index orders_status_idx        on orders(status);
create index orders_mpesa_checkout_idx on orders(mpesa_checkout_request_id)
  where mpesa_checkout_request_id is not null;

alter table orders enable row level security;
create policy "Users can view their own orders"
  on orders for select using (
    auth.uid() = buyer_id or
    exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );
create policy "Authenticated users can create orders"
  on orders for insert with check (auth.uid() = buyer_id);
create policy "Orders can be updated by buyer or admin"
  on orders for update using (
    auth.uid() = buyer_id or
    exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );

-- ============================================================
-- REVIEWS
-- ============================================================
create table reviews (
  id           uuid default uuid_generate_v4() primary key,
  listing_id   uuid references listings(id) on delete cascade not null,
  reviewer_id  uuid references profiles(id) on delete cascade not null,
  seller_id    uuid references profiles(id) on delete cascade not null,
  order_id     text references orders(id),
  rating       integer not null check (rating between 1 and 5),
  comment      text,
  created_at   timestamptz default now(),
  unique(reviewer_id, listing_id)
);

alter table reviews enable row level security;
create policy "Reviews are viewable by everyone"
  on reviews for select using (true);
create policy "Buyers can create reviews"
  on reviews for insert with check (
    auth.uid() = reviewer_id and
    exists (
      select 1 from orders
      where id = order_id and buyer_id = auth.uid() and status = 'delivered'
    )
  );

-- ============================================================
-- MESSAGES
-- ============================================================
create table messages (
  id           uuid default uuid_generate_v4() primary key,
  sender_id    uuid references profiles(id) on delete cascade not null,
  receiver_id  uuid references profiles(id) on delete cascade not null,
  listing_id   uuid references listings(id) on delete set null,
  content      text not null,
  is_read      boolean default false,
  created_at   timestamptz default now()
);

create index messages_sender_id_idx   on messages(sender_id);
create index messages_receiver_id_idx on messages(receiver_id);

alter table messages enable row level security;
create policy "Users can view their own messages"
  on messages for select using (
    auth.uid() = sender_id or auth.uid() = receiver_id
  );
create policy "Authenticated users can send messages"
  on messages for insert with check (auth.uid() = sender_id);
create policy "Receivers can mark messages as read"
  on messages for update using (auth.uid() = receiver_id);

-- ============================================================
-- NOTIFICATIONS
-- ============================================================
create table notifications (
  id          uuid default uuid_generate_v4() primary key,
  user_id     uuid references profiles(id) on delete cascade not null,
  type        text not null,
  title       text not null,
  message     text not null,
  data        jsonb default '{}',
  is_read     boolean default false,
  created_at  timestamptz default now()
);

create index notifications_user_id_idx on notifications(user_id);
create index notifications_is_read_idx on notifications(is_read) where is_read = false;

alter table notifications enable row level security;
create policy "Users can manage their own notifications"
  on notifications for all using (auth.uid() = user_id);

-- ============================================================
-- STORAGE BUCKETS
-- ============================================================
insert into storage.buckets (id, name, public) values
  ('listing-images',    'listing-images',    true),
  ('verification-docs', 'verification-docs', false),
  ('profile-pictures',  'profile-pictures',  true)
on conflict (id) do nothing;

create policy "Anyone can view listing images"
  on storage.objects for select using (bucket_id = 'listing-images');
create policy "Authenticated users can upload listing images"
  on storage.objects for insert with check (
    bucket_id = 'listing-images' and auth.role() = 'authenticated'
  );
create policy "Users can update their own listing images"
  on storage.objects for update using (
    bucket_id = 'listing-images' and auth.uid()::text = (storage.foldername(name))[1]
  );
create policy "Users can delete their own listing images"
  on storage.objects for delete using (
    bucket_id = 'listing-images' and auth.uid()::text = (storage.foldername(name))[1]
  );
create policy "Sellers can upload verification docs"
  on storage.objects for insert with check (
    bucket_id = 'verification-docs' and auth.role() = 'authenticated'
  );
create policy "Admins and owners can view verification docs"
  on storage.objects for select using (
    bucket_id = 'verification-docs' and (
      auth.uid()::text = (storage.foldername(name))[2] or
      exists (select 1 from profiles where id = auth.uid() and role = 'admin')
    )
  );
create policy "Anyone can view profile pictures"
  on storage.objects for select using (bucket_id = 'profile-pictures');
create policy "Users can upload their own profile picture"
  on storage.objects for insert with check (
    bucket_id = 'profile-pictures' and auth.role() = 'authenticated'
  );

-- ============================================================
-- FUNCTIONS & TRIGGERS
-- ============================================================

-- Auto-create profile on signup (email/password & OAuth)
create or replace function handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url, role)
  values (
    new.id,
    new.email,
    coalesce(
      new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->>'name',
      split_part(new.email, '@', 1)
    ),
    new.raw_user_meta_data->>'avatar_url',
    coalesce((new.raw_user_meta_data->>'role')::user_role, 'buyer')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

-- Increment listing views
create or replace function increment_listing_views(listing_id uuid)
returns void language plpgsql security definer as $$
begin
  update listings set views = views + 1 where id = listing_id;
end;
$$;

-- Update seller rating when a review is added
create or replace function update_seller_rating()
returns trigger language plpgsql security definer as $$
begin
  update profiles
  set
    rating = (select round(avg(rating)::numeric, 2) from reviews where seller_id = new.seller_id),
    total_reviews = (select count(*) from reviews where seller_id = new.seller_id)
  where id = new.seller_id;
  return new;
end;
$$;

create trigger on_review_created
  after insert on reviews
  for each row execute procedure update_seller_rating();

-- Auto-update updated_at
create or replace function update_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger listings_updated_at before update on listings for each row execute procedure update_updated_at();
create trigger profiles_updated_at before update on profiles for each row execute procedure update_updated_at();
create trigger orders_updated_at   before update on orders   for each row execute procedure update_updated_at();

-- End expired auctions
create or replace function end_expired_auctions()
returns void language plpgsql security definer as $$
declare
  expired record;
begin
  for expired in
    select l.id, b.bidder_id as highest_bidder
    from listings l
    left join bids b on b.listing_id = l.id and b.is_winning = true
    where l.listing_type = 'auction'
      and l.status = 'active'
      and l.auction_end_time <= now()
  loop
    if expired.highest_bidder is not null then
      update listings
        set status = 'sold', current_bidder_id = expired.highest_bidder
        where id = expired.id;
    else
      update listings set status = 'ended' where id = expired.id;
    end if;
  end loop;
end;
$$;

-- ============================================================
-- REALTIME
-- ============================================================
alter publication supabase_realtime add table bids;
alter publication supabase_realtime add table listings;
alter publication supabase_realtime add table notifications;
alter publication supabase_realtime add table messages;
