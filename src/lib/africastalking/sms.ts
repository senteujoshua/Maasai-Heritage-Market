import axios from 'axios';

const AT_BASE = 'https://api.africastalking.com/version1';
const AT_SANDBOX = 'https://api.sandbox.africastalking.com/version1';

function getBaseURL() {
  return process.env.AT_USERNAME === 'sandbox' ? AT_SANDBOX : AT_BASE;
}

export interface SMSParams {
  to: string | string[];
  message: string;
  from?: string;
}

export async function sendSMS(params: SMSParams): Promise<void> {
  const recipients = Array.isArray(params.to) ? params.to.join(',') : params.to;
  try {
    await axios.post(
      `${getBaseURL()}/messaging`,
      new URLSearchParams({
        username: process.env.AT_USERNAME!,
        to: recipients,
        message: params.message,
        from: params.from || process.env.AT_SENDER_ID || 'MaasaiMkt',
      }),
      {
        headers: {
          apiKey: process.env.AT_API_KEY!,
          Accept: 'application/json',
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    );
  } catch (error) {
    console.error('SMS send failed:', error);
    // Non-blocking — SMS failure shouldn't break the flow
  }
}

export const SMS_TEMPLATES = {
  bidPlaced: (title: string, amount: number, link: string) =>
    `MaasaiMkt: Your bid of KES ${amount.toLocaleString()} on "${title}" was placed! ${link}`,
  outbid: (title: string, newBid: number, link: string) =>
    `MaasaiMkt: You've been outbid on "${title}". Current: KES ${newBid.toLocaleString()}. Bid again: ${link}`,
  auctionWon: (title: string, amount: number, link: string) =>
    `Congrats! You won "${title}" for KES ${amount.toLocaleString()} on MaasaiMkt. Pay: ${link}`,
  orderConfirmed: (orderId: string, total: number) =>
    `MaasaiMkt: Order ${orderId} confirmed! Total: KES ${total.toLocaleString()}. We'll notify when shipped.`,
  orderShipped: (orderId: string, tracking: string) =>
    `MaasaiMkt: Order ${orderId} shipped! Tracking: ${tracking}. Expected 2-5 business days.`,
  sellerNewOrder: (title: string, buyer: string, amount: number) =>
    `MaasaiMkt: New order for "${title}" from ${buyer}. KES ${amount.toLocaleString()}. Check dashboard.`,
  verificationApproved: (name: string) =>
    `Congratulations ${name}! Your MaasaiMkt seller account is verified. Start listing today!`,
  verificationRejected: (reason: string) =>
    `MaasaiMkt: Seller verification not approved. Reason: ${reason}. Email: support@maasaiheritage.co.ke`,
};
