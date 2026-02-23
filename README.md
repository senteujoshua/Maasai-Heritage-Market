# 🌍 Maasai Heritage Market

Kenya's premier cultural marketplace for authentic Maasai art, jewelry, textiles, and crafts. Built with Next.js 14, Supabase, and M-Pesa.

## ✨ Features

- **Live Auctions** — 6–24 hour timed auctions with real-time bidding via Supabase Realtime
- **Fixed-Price Shop** — Buy authentic Maasai items instantly
- **M-Pesa Payments** — Safaricom Daraja STK Push integration
- **Seller Verification** — National ID + KRA PIN document upload and admin review
- **SMS Notifications** — Bid alerts, order confirmations via Africa's Talking
- **PWA Ready** — Service Worker + Web App Manifest for mobile-first experience
- **Dark Mode** — Full dark/light theme support
- **Admin Dashboard** — Listing moderation and seller verification review
- **Cultural Stories** — Sellers share the heritage behind each piece

## 🚀 Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 14 (App Router) |
| Database | Supabase (PostgreSQL) |
| Auth | Supabase Auth |
| Realtime | Supabase Realtime |
| Storage | Supabase Storage |
| Payments | M-Pesa Daraja API |
| SMS | Africa's Talking |
| Styling | Tailwind CSS |
| Forms | React Hook Form + Zod |
| Hosting | Vercel |

## 📋 Prerequisites

- Node.js 18+
- A [Supabase](https://supabase.com) account (free tier works)
- A [Safaricom Developer](https://developer.safaricom.co.ke) account for M-Pesa
- An [Africa's Talking](https://africastalking.com) account for SMS

## 🛠️ Setup

### 1. Clone and install

```bash
git clone <repo-url>
cd maasai-heritage-market
npm install
```

### 2. Configure environment variables

```bash
cp .env.example .env.local
```

Fill in your `.env.local`:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# M-Pesa (Daraja API)
MPESA_CONSUMER_KEY=your-consumer-key
MPESA_CONSUMER_SECRET=your-consumer-secret
MPESA_SHORTCODE=174379
MPESA_PASSKEY=your-lipa-na-mpesa-passkey
MPESA_CALLBACK_URL=https://your-domain.vercel.app/api/mpesa/callback
MPESA_ENVIRONMENT=sandbox  # or "production"

# Africa's Talking
AFRICASTALKING_API_KEY=your-at-api-key
AFRICASTALKING_USERNAME=sandbox  # or your username
AFRICASTALKING_SENDER_ID=MaasaiMkt  # optional

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 3. Set up the database

1. Go to your Supabase project → **SQL Editor**
2. Paste and run `supabase/migrations/001_initial_schema.sql`
3. This creates all tables, RLS policies, functions, and seeds categories

### 4. Configure Supabase Storage

The migration creates these buckets automatically:
- `listing-images` (public) — Product photos
- `verification-docs` (private) — Seller ID documents
- `profile-pictures` (public) — User avatars

If not created, go to Supabase → Storage → New Bucket and create them manually.

### 5. Configure Supabase Auth

In Supabase → Authentication → Settings:
- Site URL: `http://localhost:3000` (or your production URL)
- Redirect URLs: Add `http://localhost:3000/**` and your production URL

### 6. Run the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## 🗃️ Project Structure

```
src/
├── app/                    # Next.js App Router pages
│   ├── (auth)/            # Login & register
│   ├── admin/             # Admin dashboard
│   ├── api/               # API routes
│   │   ├── auctions/bid/  # Bid placement
│   │   ├── mpesa/         # STK Push & callback
│   │   └── sms/           # Admin SMS sending
│   ├── auctions/          # Live auctions page
│   ├── cart/              # Shopping cart
│   ├── checkout/          # Checkout + M-Pesa
│   ├── marketplace/       # Product listing & detail
│   └── seller/            # Seller dashboard + listings
├── components/
│   ├── layout/            # Navbar, Footer
│   ├── marketplace/       # ProductCard, CategoryFilter, AuctionTimer, BidForm
│   ├── seller/            # ListingForm
│   └── ui/                # Button, Badge, Modal
├── hooks/                 # useAuth, useCart, useAuction
├── lib/
│   ├── africastalking/    # SMS integration
│   ├── mpesa/             # Daraja API
│   ├── supabase/          # Client & server clients
│   └── utils.ts           # Helpers
├── middleware.ts           # Route protection + RBAC
└── types/index.ts         # TypeScript types
```

## 💳 M-Pesa Integration

### Sandbox Testing

1. Go to [developer.safaricom.co.ke](https://developer.safaricom.co.ke)
2. Create an app and note Consumer Key & Secret
3. For sandbox, use shortcode `174379` and passkey from the simulator
4. Test phone: Use any Safaricom number in the Daraja sandbox simulator

### Production Setup

1. Apply for M-Pesa Daraja Go-Live from Safaricom
2. Update `MPESA_ENVIRONMENT=production` in env
3. Register your callback URL with Safaricom
4. Update shortcode and passkey with your production credentials

### Callback URL for Local Dev

Use [ngrok](https://ngrok.com) to expose localhost:

```bash
ngrok http 3000
# Copy the HTTPS URL → set MPESA_CALLBACK_URL=https://xxxx.ngrok.io/api/mpesa/callback
```

## 📱 SMS Notifications

Africa's Talking sends SMS for:
- **Outbid alert** — When someone bids higher
- **Auction won** — Winning bidder notification
- **Order confirmed** — After successful payment
- **Order shipped** — When seller marks as shipped
- **Verification approved/rejected** — Seller document review

For sandbox testing, use the Africa's Talking simulator.

## 🚀 Deployment (Vercel)

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel --prod
```

Set all environment variables in Vercel Dashboard → Project → Settings → Environment Variables.

### Production Checklist

- [ ] Set `MPESA_ENVIRONMENT=production` and update M-Pesa credentials
- [ ] Update `MPESA_CALLBACK_URL` to production domain
- [ ] Set up pg_cron for `end_expired_auctions()`:
  ```sql
  select cron.schedule('end-expired-auctions', '* * * * *', 'select end_expired_auctions()');
  ```
- [ ] Configure Supabase Auth redirect URLs
- [ ] Set up Supabase Edge Function for auction ending (alternative to pg_cron)
- [ ] Enable Supabase Realtime for `bids`, `listings`, `notifications`, `messages` tables
- [ ] Add admin user: Update user role to `admin` in Supabase profiles table
- [ ] Configure custom domain

## 👤 User Roles

| Role | Capabilities |
|------|-------------|
| **Buyer** | Browse, search, wishlist, cart, checkout, bid, review, message sellers |
| **Seller** | All buyer features + create listings (fixed/auction), manage shop, verification |
| **Admin** | All features + approve/reject listings, verify sellers, view platform stats |

### Creating an Admin User

After registering, run in Supabase SQL Editor:
```sql
update profiles set role = 'admin' where email = 'your-admin@email.com';
```

## 🔒 Security

- All routes protected by Row Level Security (RLS) on Supabase
- Middleware RBAC for `/admin`, `/seller`, `/checkout`, `/orders`, `/profile`
- Documents encrypted at rest in Supabase Storage
- KDPA 2019 compliant data handling
- M-Pesa callbacks verified against CheckoutRequestID

## 📊 Database Schema

Key tables:
- `profiles` — Users (buyers, sellers, admins)
- `listings` — Products and auctions
- `listing_images` — Product photos
- `bids` — Auction bids
- `cart_items` — Shopping cart
- `wishlists` — Saved items
- `orders` — Purchase records (JSON items)
- `reviews` — Product & seller reviews
- `messages` — Buyer-seller messaging
- `notifications` — In-app notifications
- `categories` — Product categories

## 🧪 Running Tests

```bash
npm run lint          # ESLint
npm run type-check    # TypeScript
npm run build         # Production build check
```

## 📄 License

MIT — Built with ❤️ in Kenya

---

*"Every purchase preserves a cultural legacy."* — Maasai Heritage Market
