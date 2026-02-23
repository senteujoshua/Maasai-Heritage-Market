export type UserRole = 'buyer' | 'seller' | 'admin';
export type VerificationStatus = 'not_submitted' | 'pending' | 'approved' | 'rejected';
export type ListingType = 'fixed' | 'auction';
export type ListingStatus = 'draft' | 'pending_approval' | 'active' | 'sold' | 'ended' | 'rejected';
export type PaymentMethod = 'mpesa' | 'card' | 'cod';
export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'refunded';
export type OrderStatus = 'pending' | 'confirmed' | 'processing' | 'shipped' | 'delivered' | 'cancelled';

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  phone: string | null;
  location: string | null;
  region: string | null;
  avatar_url: string | null;
  bio: string | null;
  role: UserRole;
  is_verified: boolean;
  verification_status: VerificationStatus;
  national_id_url: string | null;
  kra_pin_url: string | null;
  shop_name: string | null;
  shop_description: string | null;
  rating: number;
  total_sales: number;
  created_at: string;
  updated_at: string;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  icon: string | null;
  image_url: string | null;
  item_count?: number;
}

export interface ListingImage {
  id: string;
  listing_id: string;
  image_url: string;
  is_primary: boolean;
  display_order: number;
}

export interface Listing {
  id: string;
  seller_id: string;
  category_id: string;
  title: string;
  description: string;
  cultural_story: string | null;
  listing_type: ListingType;
  price: number | null;
  auction_start_time: string | null;
  auction_end_time: string | null;
  auction_duration_hours: number | null;
  starting_bid: number | null;
  current_bid: number | null;
  current_bidder_id: string | null;
  bid_count: number;
  status: ListingStatus;
  region: string;
  stock_quantity: number;
  shipping_details: string | null;
  estimated_shipping_days: number | null;
  is_approved: boolean;
  views: number;
  created_at: string;
  updated_at: string;
  seller?: Profile;
  category?: Category;
  images?: ListingImage[];
  current_bidder?: Profile;
}

export interface Bid {
  id: string;
  listing_id: string;
  bidder_id: string;
  amount: number;
  is_winning: boolean;
  created_at: string;
  bidder?: Profile;
  listing?: Listing;
}

export interface CartItem {
  id: string;
  user_id: string;
  listing_id: string;
  quantity: number;
  created_at: string;
  listing?: Listing;
}

export interface WishlistItem {
  id: string;
  user_id: string;
  listing_id: string;
  created_at: string;
  listing?: Listing;
}

export interface ShippingAddress {
  full_name: string;
  phone: string;
  email: string;
  address_line1: string;
  address_line2?: string;
  city: string;
  county: string;
  postal_code?: string;
}

export interface Order {
  id: string;
  buyer_id: string;
  seller_id: string;
  listing_id: string;
  quantity: number;
  unit_price: number;
  total_amount: number;
  platform_commission: number;
  seller_amount: number;
  payment_method: PaymentMethod;
  payment_status: PaymentStatus;
  order_status: OrderStatus;
  shipping_address: ShippingAddress;
  tracking_number: string | null;
  mpesa_reference: string | null;
  mpesa_receipt: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  buyer?: Profile;
  seller?: Profile;
  listing?: Listing;
}

export interface Review {
  id: string;
  order_id: string;
  reviewer_id: string;
  seller_id: string;
  listing_id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  reviewer?: Profile;
}

export interface Message {
  id: string;
  sender_id: string;
  receiver_id: string;
  listing_id: string | null;
  content: string;
  is_read: boolean;
  created_at: string;
  sender?: Profile;
  receiver?: Profile;
}

export interface Notification {
  id: string;
  user_id: string;
  type: 'bid_placed' | 'outbid' | 'auction_won' | 'auction_ended' | 'order_confirmed' | 'order_shipped' | 'order_delivered' | 'new_message' | 'verification_update' | 'listing_approved';
  title: string;
  message: string;
  data: Record<string, unknown>;
  is_read: boolean;
  created_at: string;
}

export interface MpesaSTKResponse {
  MerchantRequestID: string;
  CheckoutRequestID: string;
  ResponseCode: string;
  ResponseDescription: string;
  CustomerMessage: string;
}

export interface MpesaCallbackData {
  Body: {
    stkCallback: {
      MerchantRequestID: string;
      CheckoutRequestID: string;
      ResultCode: number;
      ResultDesc: string;
      CallbackMetadata?: {
        Item: Array<{ Name: string; Value: string | number }>;
      };
    };
  };
}

export interface SearchFilters {
  query?: string;
  category?: string;
  listing_type?: ListingType | 'all';
  min_price?: number;
  max_price?: number;
  region?: string;
  sort_by?: 'newest' | 'price_asc' | 'price_desc' | 'ending_soon' | 'most_bids';
}

export type KenyanRegion =
  | 'Nairobi' | 'Narok' | 'Kajiado' | 'Mombasa' | 'Kisumu'
  | 'Nakuru' | 'Eldoret' | 'Nyeri' | 'Meru' | 'Thika' | 'Other';

export const KENYAN_REGIONS: KenyanRegion[] = [
  'Nairobi', 'Narok', 'Kajiado', 'Mombasa', 'Kisumu',
  'Nakuru', 'Eldoret', 'Nyeri', 'Meru', 'Thika', 'Other',
];

export const CATEGORIES = [
  { name: 'Drawings & Art', slug: 'drawings-art', icon: '🎨' },
  { name: 'Attire & Clothing', slug: 'attire-clothing', icon: '👘' },
  { name: 'Beaded Jewelry', slug: 'beaded-jewelry', icon: '📿' },
  { name: 'Cultural Tools', slug: 'cultural-tools', icon: '🪘' },
  { name: 'Home Décor', slug: 'home-decor', icon: '🏺' },
  { name: 'Shukas & Textiles', slug: 'shukas-textiles', icon: '🧣' },
];
