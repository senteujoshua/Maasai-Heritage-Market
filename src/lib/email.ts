import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM  = process.env.EMAIL_FROM     ?? 'Maasai Heritage Market <noreply@maasaiheritagemarket.com>';
const SITE  = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://maasaiheritagemarket.com';
const RED   = '#6D001A';
const BEIGE = '#F5F0E8';

// ── Base wrapper ─────────────────────────────────────────────────────────────

function base(title: string, body: string): string {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${title}</title></head>
<body style="margin:0;padding:0;background:#f9f7f4;font-family:Georgia,serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f9f7f4;padding:32px 16px;">
  <tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08);">
      <!-- Header -->
      <tr><td style="background:${RED};padding:24px 32px;text-align:center;">
        <h1 style="margin:0;color:#fff;font-size:22px;font-weight:700;letter-spacing:1px;">
          🏺 Maasai Heritage Market
        </h1>
        <p style="margin:4px 0 0;color:rgba(255,255,255,.7);font-size:12px;">Authentic Kenyan Artisan Goods</p>
      </td></tr>
      <!-- Body -->
      <tr><td style="padding:32px;">${body}</td></tr>
      <!-- Footer -->
      <tr><td style="background:${BEIGE};padding:20px 32px;text-align:center;">
        <p style="margin:0;color:#888;font-size:11px;line-height:1.6;">
          © ${new Date().getFullYear()} Maasai Heritage Market · Nairobi, Kenya<br/>
          <a href="${SITE}" style="color:${RED};text-decoration:none;">${SITE}</a>
        </p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;
}

function heading(text: string) {
  return `<h2 style="margin:0 0 16px;color:${RED};font-size:20px;">${text}</h2>`;
}

function para(text: string) {
  return `<p style="margin:0 0 12px;color:#444;font-size:15px;line-height:1.6;">${text}</p>`;
}

function btn(label: string, url: string) {
  return `<div style="margin:20px 0;">
    <a href="${url}" style="display:inline-block;background:${RED};color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-size:15px;font-weight:700;">${label}</a>
  </div>`;
}

function divider() {
  return `<hr style="border:none;border-top:1px solid ${BEIGE};margin:20px 0;"/>`;
}

// ── Templates ────────────────────────────────────────────────────────────────

export function orderConfirmedHtml(opts: {
  buyerName: string;
  orderId:   string;
  total:     number;
  method:    string;
  items:     Array<{ title: string; quantity: number; unit_price: number }>;
}) {
  const rows = opts.items.map((i) =>
    `<tr>
      <td style="padding:8px 0;border-bottom:1px solid ${BEIGE};color:#333;font-size:14px;">${i.title} × ${i.quantity}</td>
      <td style="padding:8px 0;border-bottom:1px solid ${BEIGE};color:#333;font-size:14px;text-align:right;">KES ${(i.unit_price * i.quantity).toLocaleString()}</td>
    </tr>`
  ).join('');

  return base('Order Confirmed', `
    ${heading('Your order is confirmed! 🎉')}
    ${para(`Hi ${opts.buyerName}, thank you for supporting Kenyan artisans. Your order has been received and is being prepared.`)}
    ${divider()}
    <table width="100%" cellpadding="0" cellspacing="0">${rows}
      <tr>
        <td style="padding:12px 0;font-weight:700;color:#222;">Total</td>
        <td style="padding:12px 0;font-weight:700;color:${RED};text-align:right;">KES ${opts.total.toLocaleString()}</td>
      </tr>
    </table>
    <p style="margin:8px 0 0;color:#888;font-size:12px;">Payment via ${opts.method.toUpperCase()}</p>
    ${divider()}
    ${btn('Track Your Order', `${SITE}/orders/${opts.orderId}`)}
    ${para('We\'ll send you another email when your order is on the way.')}
  `);
}

export function orderShippedHtml(opts: {
  buyerName:    string;
  orderId:      string;
  trackingCode: string;
}) {
  return base('Your Order is On the Way', `
    ${heading('Your order has been shipped! 🚚')}
    ${para(`Hi ${opts.buyerName}, great news — your order is now on its way to you.`)}
    ${divider()}
    <div style="background:${BEIGE};border-radius:8px;padding:16px;text-align:center;margin:16px 0;">
      <p style="margin:0 0 4px;color:#888;font-size:12px;text-transform:uppercase;letter-spacing:1px;">Tracking Code</p>
      <p style="margin:0;font-family:monospace;font-size:22px;font-weight:700;color:${RED};">${opts.trackingCode}</p>
    </div>
    ${btn('Track Your Order', `${SITE}/orders/${opts.orderId}`)}
    ${para('Our field agent will contact you before delivery.')}
  `);
}

export function orderDeliveredHtml(opts: {
  buyerName: string;
  orderId:   string;
  listingId: string;
  itemTitle: string;
}) {
  return base('Order Delivered — Leave a Review', `
    ${heading('Your order has been delivered! ✅')}
    ${para(`Hi ${opts.buyerName}, your order for <strong>${opts.itemTitle}</strong> has been delivered. We hope you love it!`)}
    ${divider()}
    ${para('Help other buyers by sharing your experience. It only takes 30 seconds.')}
    ${btn('Leave a Review', `${SITE}/marketplace/${opts.listingId}`)}
    ${para('Your review helps support the artisan and builds trust in our community. Thank you!')}
  `);
}

export function sellerVerifiedHtml(opts: {
  sellerName: string;
}) {
  return base('You\'re a Verified Artisan!', `
    ${heading('Congratulations — Verified! 🏅')}
    ${para(`Hi ${opts.sellerName}, your National ID and KRA PIN have been verified by our team.`)}
    ${para('You are now a <strong>Verified Artisan</strong> on Maasai Heritage Market. Your listings will display the verified badge, helping buyers trust your products.')}
    ${divider()}
    ${btn('Go to Seller Dashboard', `${SITE}/seller/dashboard`)}
    ${para('Keep creating authentic, high-quality listings. Your craftsmanship represents Kenyan culture.')}
  `);
}

export function sellerVerificationRejectedHtml(opts: {
  sellerName: string;
  reason:     string;
}) {
  return base('Verification Update', `
    ${heading('Verification update')}
    ${para(`Hi ${opts.sellerName}, unfortunately we were unable to verify your documents at this time.`)}
    <div style="background:#fff5f5;border-left:4px solid #e53e3e;padding:12px 16px;border-radius:0 8px 8px 0;margin:16px 0;">
      <p style="margin:0;color:#c53030;font-size:14px;"><strong>Reason:</strong> ${opts.reason}</p>
    </div>
    ${para('Please re-submit with clearer, valid documents. We accept JPG, PNG or PDF.')}
    ${btn('Resubmit Documents', `${SITE}/seller/dashboard`)}
  `);
}

export function listingApprovedHtml(opts: {
  sellerName: string;
  listingTitle: string;
  listingId:    string;
}) {
  return base('Listing Approved', `
    ${heading('Your listing is live! 🎊')}
    ${para(`Hi ${opts.sellerName}, your listing <strong>"${opts.listingTitle}"</strong> has been approved and is now visible on the marketplace.`)}
    ${btn('View Your Listing', `${SITE}/marketplace/${opts.listingId}`)}
    ${para('Share the link with your network to get your first sale!')}
  `);
}

export function listingRejectedHtml(opts: {
  sellerName:   string;
  listingTitle: string;
  reason:       string;
}) {
  return base('Listing Update', `
    ${heading('Listing not approved')}
    ${para(`Hi ${opts.sellerName}, your listing <strong>"${opts.listingTitle}"</strong> could not be approved at this time.`)}
    <div style="background:#fff5f5;border-left:4px solid #e53e3e;padding:12px 16px;border-radius:0 8px 8px 0;margin:16px 0;">
      <p style="margin:0;color:#c53030;font-size:14px;"><strong>Reason:</strong> ${opts.reason}</p>
    </div>
    ${para('Please edit your listing to address the above and resubmit for review.')}
    ${btn('Go to My Listings', `${SITE}/seller/dashboard`)}
  `);
}

// ── sendEmail ────────────────────────────────────────────────────────────────

export async function sendEmail({
  to,
  subject,
  html,
}: {
  to:      string;
  subject: string;
  html:    string;
}): Promise<void> {
  if (!process.env.RESEND_API_KEY) return; // skip if not configured
  try {
    await resend.emails.send({ from: FROM, to, subject, html });
  } catch (err) {
    console.error('[email] send failed:', err);
  }
}
