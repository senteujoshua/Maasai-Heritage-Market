-- 013_notification_triggers.sql
-- DB triggers that auto-insert rows into `notifications` on key business events.
-- The notifications table already exists (migration 001) and is on realtime.

-- ─────────────────────────────────────────────────────────────────────────────
-- Helper: insert one notification row
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function create_notification(
  p_user_id uuid,
  p_type    text,
  p_title   text,
  p_message text,
  p_data    jsonb default '{}'
) returns void language plpgsql security definer as $$
begin
  insert into notifications (user_id, type, title, message, data)
  values (p_user_id, p_type, p_title, p_message, p_data);
exception when others then
  -- swallow errors so a notification failure never breaks the originating transaction
  null;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Bids: notify seller (new bid) + previous winning bidder (outbid)
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function notify_on_bid()
returns trigger language plpgsql security definer as $$
declare
  v_listing     listings%rowtype;
  v_bidder_name text;
begin
  select * into v_listing from listings where id = NEW.listing_id;
  select full_name into v_bidder_name from profiles where id = NEW.bidder_id;

  -- Notify seller of the new bid (unless seller is the bidder)
  if v_listing.seller_id is not null and v_listing.seller_id <> NEW.bidder_id then
    perform create_notification(
      v_listing.seller_id,
      'bid_placed',
      'New bid on your auction',
      v_bidder_name || ' bid KES ' || NEW.amount::text || ' on "' || v_listing.title || '".',
      jsonb_build_object('listing_id', v_listing.id, 'bid_id', NEW.id, 'amount', NEW.amount)
    );
  end if;

  -- Notify previous winning bidder they have been outbid
  if v_listing.current_bidder_id is not null
    and v_listing.current_bidder_id <> NEW.bidder_id then
    perform create_notification(
      v_listing.current_bidder_id,
      'outbid',
      'You''ve been outbid!',
      'Someone bid KES ' || NEW.amount::text || ' on "' || v_listing.title || '". Place a higher bid to win.',
      jsonb_build_object('listing_id', v_listing.id, 'amount', NEW.amount)
    );
  end if;

  return NEW;
end;
$$;

drop trigger if exists trg_notify_on_bid on bids;
create trigger trg_notify_on_bid
  after insert on bids
  for each row execute function notify_on_bid();

-- ─────────────────────────────────────────────────────────────────────────────
-- Listings: approval, rejection, auction sold/ended
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function notify_on_listing_change()
returns trigger language plpgsql security definer as $$
begin
  if OLD.status is distinct from NEW.status then

    -- Manager approved the listing
    if NEW.status = 'active' and OLD.status = 'pending_approval' then
      perform create_notification(
        NEW.seller_id,
        'listing_approved',
        'Listing approved!',
        '"' || NEW.title || '" is now live on the marketplace.',
        jsonb_build_object('listing_id', NEW.id)
      );

    -- Manager rejected the listing
    elsif NEW.status = 'rejected' then
      perform create_notification(
        NEW.seller_id,
        'listing_approved',
        'Listing not approved',
        '"' || NEW.title || '" was not approved. Check the rejection reason and resubmit.',
        jsonb_build_object('listing_id', NEW.id)
      );

    -- Auction sold (end_expired_auctions cron + bid winner)
    elsif NEW.status = 'sold' then
      if NEW.current_bidder_id is not null then
        perform create_notification(
          NEW.current_bidder_id,
          'auction_won',
          'You won the auction!',
          'Congratulations! You won "' || NEW.title || '" for KES ' || NEW.current_bid::text || '. Proceed to checkout.',
          jsonb_build_object('listing_id', NEW.id, 'amount', NEW.current_bid)
        );
      end if;
      perform create_notification(
        NEW.seller_id,
        'auction_ended',
        'Auction ended — item sold!',
        '"' || NEW.title || '" sold for KES ' || NEW.current_bid::text || '.',
        jsonb_build_object('listing_id', NEW.id, 'amount', NEW.current_bid)
      );

    -- Auction ended with no bids
    elsif NEW.status = 'ended' then
      perform create_notification(
        NEW.seller_id,
        'auction_ended',
        'Auction ended with no bids',
        '"' || NEW.title || '" auction ended without any bids. You can relist it.',
        jsonb_build_object('listing_id', NEW.id)
      );
    end if;
  end if;

  return NEW;
end;
$$;

drop trigger if exists trg_notify_on_listing_change on listings;
create trigger trg_notify_on_listing_change
  after update on listings
  for each row execute function notify_on_listing_change();

-- ─────────────────────────────────────────────────────────────────────────────
-- Profiles: seller verification approved / rejected
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function notify_on_verification()
returns trigger language plpgsql security definer as $$
begin
  if OLD.verification_status is distinct from NEW.verification_status then
    if NEW.verification_status = 'approved' then
      perform create_notification(
        NEW.id,
        'verification_update',
        'You are now a Verified Artisan!',
        'Your National ID and KRA PIN have been verified. The Verified Artisan badge is now visible on your shop.',
        '{}'::jsonb
      );
    elsif NEW.verification_status = 'rejected' then
      perform create_notification(
        NEW.id,
        'verification_update',
        'Verification not approved',
        'Your verification documents were not accepted. Please resubmit clearer copies from your seller dashboard.',
        '{}'::jsonb
      );
    end if;
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_notify_on_verification on profiles;
create trigger trg_notify_on_verification
  after update on profiles
  for each row execute function notify_on_verification();

-- ─────────────────────────────────────────────────────────────────────────────
-- Orders: new order + status changes + agent assignment
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function notify_on_order()
returns trigger language plpgsql security definer as $$
declare
  v_ref text;
begin
  v_ref := coalesce(NEW.tracking_code, left(NEW.id::text, 8));

  -- New order: confirm to buyer
  if TG_OP = 'INSERT' then
    perform create_notification(
      NEW.buyer_id,
      'order_confirmed',
      'Order confirmed',
      'Your order ' || v_ref || ' has been placed successfully.',
      jsonb_build_object('order_id', NEW.id)
    );
    return NEW;
  end if;

  -- Status changes
  if OLD.status is distinct from NEW.status then
    if NEW.status = 'processing' then
      perform create_notification(
        NEW.buyer_id, 'order_processing', 'Order being prepared',
        'Your order ' || v_ref || ' is being prepared for dispatch.',
        jsonb_build_object('order_id', NEW.id)
      );
    elsif NEW.status = 'shipped' then
      perform create_notification(
        NEW.buyer_id, 'order_shipped', 'Order shipped',
        'Your order ' || v_ref || ' is on its way!',
        jsonb_build_object('order_id', NEW.id)
      );
    elsif NEW.status = 'delivered' then
      perform create_notification(
        NEW.buyer_id, 'order_delivered', 'Order delivered',
        'Your order ' || v_ref || ' has been delivered. Enjoy your purchase!',
        jsonb_build_object('order_id', NEW.id)
      );
    end if;
  end if;

  -- Agent assignment
  if OLD.assigned_agent_id is distinct from NEW.assigned_agent_id
    and NEW.assigned_agent_id is not null then
    perform create_notification(
      NEW.assigned_agent_id, 'order_assigned', 'New delivery assigned',
      'Order ' || v_ref || ' has been assigned to you for delivery.',
      jsonb_build_object('order_id', NEW.id)
    );
  end if;

  return NEW;
end;
$$;

drop trigger if exists trg_notify_on_order on orders;
create trigger trg_notify_on_order
  after insert or update on orders
  for each row execute function notify_on_order();
