'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { PayPalScriptProvider, PayPalButtons } from '@paypal/react-paypal-js';
import { useAuth } from '@/hooks/useAuth';
import { useCart } from '@/hooks/useCart';
import { Button } from '@/components/ui/Button';
import { StripePaymentForm } from '@/components/checkout/StripePaymentForm';
import { formatKES, generateOrderId, sanitizePhone } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';
import { MapPin, Phone, CreditCard, Smartphone, Truck, ShieldCheck, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { cn } from '@/lib/utils';

const schema = z.object({
  full_name: z.string().min(3, 'Enter your full name'),
  phone: z.string().regex(/^(?:\+254|0)[17]\d{8}$/, 'Enter a valid Kenyan phone number'),
  address_line: z.string().min(5, 'Enter a street address'),
  city: z.string().min(2, 'Enter a city'),
  county: z.string().min(2, 'Enter a county'),
  payment_method: z.enum(['mpesa', 'card', 'paypal', 'cod']),
  mpesa_phone: z.string().optional(),
}).refine((d) => d.payment_method !== 'mpesa' || (d.mpesa_phone && /^(?:\+254|0)[17]\d{8}$/.test(d.mpesa_phone)), {
  message: 'Enter a valid M-Pesa phone number',
  path: ['mpesa_phone'],
});

type FormData = z.infer<typeof schema>;

const PAYMENT_OPTIONS = [
  { value: 'mpesa', label: '📱 M-Pesa', desc: 'Pay via M-Pesa STK Push (recommended)' },
  { value: 'card', label: '💳 Card (Stripe)', desc: 'Visa, Mastercard, or any debit/credit card' },
  { value: 'paypal', label: '🅿️ PayPal', desc: 'Pay securely with your PayPal account' },
  { value: 'cod', label: '💵 Cash on Delivery', desc: 'Pay when your item arrives' },
] as const;

export default function CheckoutPage() {
  const { profile, loading: authLoading } = useAuth();
  const { items, total, clearCart } = useCart(profile?.id);
  const router = useRouter();
  const [step, setStep] = useState<'form' | 'stripe_payment' | 'confirming' | 'success'>('form');
  const [orderId, setOrderId] = useState('');
  const [stripeClientSecret, setStripeClientSecret] = useState<string | null>(null);
  const pendingPaypalOrderIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!authLoading && !profile) router.push('/login?redirect=/checkout');
    if (!authLoading && profile && items.length === 0) router.push('/cart');
  }, [profile, authLoading, items.length, router]);

  const { register, handleSubmit, watch, trigger, getValues, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      full_name: profile?.full_name || '',
      phone: profile?.phone || '',
      payment_method: 'mpesa',
      mpesa_phone: profile?.phone || '',
    },
  });

  const paymentMethod = watch('payment_method');
  const delivery = total > 5000 ? 0 : 350;
  const grandTotal = total + delivery;

  const inputCls = (hasError: boolean) => cn(
    'w-full px-4 py-3 rounded-xl border-2 bg-white dark:bg-maasai-brown text-maasai-black dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-maasai-red transition-colors',
    hasError ? 'border-red-400' : 'border-maasai-beige dark:border-maasai-brown-light focus:border-maasai-red'
  );

  async function buildOrderPayload(data: FormData, payMethod: string, paidAt?: string) {
    return {
      buyer_id: profile!.id,
      items: items.map((item) => ({
        listing_id: item.listing_id,
        quantity: item.quantity,
        price: (item.listing as unknown as Record<string, unknown>)?.price as number || 0,
      })),
      subtotal: total,
      delivery_fee: delivery,
      total: grandTotal,
      payment_method: payMethod,
      payment_status: paidAt ? 'completed' : 'pending',
      status: paidAt ? 'confirmed' : 'pending',
      shipping_address: {
        full_name: data.full_name,
        phone: data.phone,
        address_line: data.address_line,
        city: data.city,
        county: data.county,
      },
      ...(paidAt ? { paid_at: paidAt } : {}),
    };
  }

  async function onSubmit(data: FormData) {
    if (data.payment_method === 'paypal') return; // handled by PayPal button
    setStep('confirming');

    try {
      const supabase = createClient();
      const newOrderId = generateOrderId();
      setOrderId(newOrderId);

      const payload = await buildOrderPayload(data, data.payment_method);
      const { error } = await supabase.from('orders').insert({ id: newOrderId, ...payload });
      if (error) throw error;

      // M-Pesa
      if (data.payment_method === 'mpesa' && data.mpesa_phone) {
        const res = await fetch('/api/mpesa/stk-push', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            phone: sanitizePhone(data.mpesa_phone),
            amount: Math.ceil(grandTotal),
            orderId: newOrderId,
            description: `Maasai Heritage Market Order ${newOrderId}`,
          }),
        });
        const stkData = await res.json();
        if (!res.ok) throw new Error(stkData.message || 'M-Pesa request failed');
        toast.success('M-Pesa STK Push sent! Check your phone.');
        await clearCart();
        setStep('success');
        return;
      }

      // Stripe card
      if (data.payment_method === 'card') {
        const res = await fetch('/api/stripe/create-intent', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ amount: grandTotal, orderId: newOrderId }),
        });
        const intentData = await res.json();
        if (!res.ok) throw new Error(intentData.error || 'Stripe initialization failed');
        setStripeClientSecret(intentData.clientSecret);
        setStep('stripe_payment');
        return;
      }

      // Cash on Delivery
      await clearCart();
      setStep('success');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Checkout failed. Please try again.';
      toast.error(message);
      setStep('form');
    }
  }

  async function handleStripeSuccess() {
    await clearCart();
    setStep('success');
  }

  function handleStripeError(message: string) {
    toast.error(message);
    setStep('form');
  }

  if (authLoading) {
    return <div className="flex items-center justify-center min-h-[60vh]"><Loader2 className="h-8 w-8 animate-spin text-maasai-red" /></div>;
  }

  // ─── Stripe card payment screen ──────────────────────────────────────────
  if (step === 'stripe_payment' && stripeClientSecret) {
    return (
      <div className="max-w-lg mx-auto px-4 py-8 sm:py-10">
        <div className="mb-6">
          <h1 className="text-xl font-bold text-maasai-black dark:text-white">Card Payment</h1>
          <p className="text-maasai-brown/60 dark:text-maasai-beige/60 text-sm mt-1">
            Order total: <span className="font-bold text-maasai-red">{formatKES(grandTotal)}</span>
          </p>
        </div>
        <div className="bg-white dark:bg-maasai-brown rounded-2xl border border-maasai-beige/30 dark:border-maasai-brown-light p-6">
          <StripePaymentForm
            clientSecret={stripeClientSecret}
            amount={grandTotal}
            onSuccess={handleStripeSuccess}
            onError={handleStripeError}
            onBack={() => setStep('form')}
          />
        </div>
      </div>
    );
  }

  // ─── Processing spinner ───────────────────────────────────────────────────
  if (step === 'confirming') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <Loader2 className="h-12 w-12 animate-spin text-maasai-red" />
        <p className="font-semibold text-maasai-black dark:text-white">Processing your order...</p>
        {paymentMethod === 'mpesa' && <p className="text-sm text-maasai-brown/60 dark:text-maasai-beige/60">Sending M-Pesa STK Push to your phone</p>}
        {paymentMethod === 'paypal' && <p className="text-sm text-maasai-brown/60 dark:text-maasai-beige/60">Confirming PayPal payment...</p>}
      </div>
    );
  }

  // ─── Success screen ───────────────────────────────────────────────────────
  if (step === 'success') {
    return (
      <div className="max-w-lg mx-auto px-4 py-16 sm:py-20 text-center">
        <div className="w-20 h-20 sm:w-24 sm:h-24 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <span className="text-4xl sm:text-5xl">🎉</span>
        </div>
        <h1 className="text-xl sm:text-2xl font-bold text-maasai-black dark:text-white mb-2">Order Confirmed!</h1>
        <p className="text-maasai-brown/60 dark:text-maasai-beige/60 mb-2 text-sm">
          Order ID: <span className="font-mono font-bold text-maasai-red">{orderId}</span>
        </p>
        {paymentMethod === 'mpesa' && (
          <p className="text-sm text-maasai-brown/70 dark:text-maasai-beige/70 mb-6 bg-green-50 dark:bg-green-900/20 rounded-xl p-3">
            ✅ M-Pesa payment prompt sent. Complete payment within 1 minute.
          </p>
        )}
        {paymentMethod === 'card' && (
          <p className="text-sm text-maasai-brown/70 dark:text-maasai-beige/70 mb-6 bg-blue-50 dark:bg-blue-900/20 rounded-xl p-3">
            ✅ Card payment confirmed via Stripe. You&apos;ll receive a confirmation email.
          </p>
        )}
        {paymentMethod === 'paypal' && (
          <p className="text-sm text-maasai-brown/70 dark:text-maasai-beige/70 mb-6 bg-blue-50 dark:bg-blue-900/20 rounded-xl p-3">
            ✅ PayPal payment confirmed. Thank you for your purchase!
          </p>
        )}
        {paymentMethod === 'cod' && (
          <p className="text-sm text-maasai-brown/70 dark:text-maasai-beige/70 mb-6 bg-maasai-beige/20 rounded-xl p-3">
            📦 Cash on Delivery selected. You&apos;ll pay when your item arrives.
          </p>
        )}
        <div className="flex flex-col sm:flex-row gap-3">
          <Button variant="primary" size="lg" onClick={() => router.push('/orders')} className="flex-1">View My Orders</Button>
          <Button variant="outline" size="lg" onClick={() => router.push('/marketplace')} className="flex-1">Continue Shopping</Button>
        </div>
      </div>
    );
  }

  // ─── Main checkout form ───────────────────────────────────────────────────
  const paypalClientId = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      <h1 className="text-xl sm:text-2xl font-bold font-display text-maasai-black dark:text-white mb-6 sm:mb-8">Checkout</h1>

      <form onSubmit={handleSubmit(onSubmit)}>
        <div className="grid lg:grid-cols-3 gap-6 sm:gap-8">
          <div className="lg:col-span-2 space-y-6 sm:space-y-8">

            {/* ── Shipping ── */}
            <div className="bg-white dark:bg-maasai-brown rounded-2xl border border-maasai-beige/30 dark:border-maasai-brown-light p-4 sm:p-6">
              <h2 className="font-bold text-maasai-black dark:text-white mb-4 sm:mb-5 flex items-center gap-2">
                <MapPin className="h-5 w-5 text-maasai-red" /> Shipping Address
              </h2>
              <div className="grid sm:grid-cols-2 gap-3 sm:gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-sm font-semibold text-maasai-brown dark:text-maasai-beige mb-1.5">Full Name</label>
                  <input {...register('full_name')} placeholder="Your full name" className={inputCls(!!errors.full_name)} />
                  {errors.full_name && <p className="text-red-500 text-xs mt-1">{errors.full_name.message}</p>}
                </div>
                <div>
                  <label className="block text-sm font-semibold text-maasai-brown dark:text-maasai-beige mb-1.5">Phone Number</label>
                  <input {...register('phone')} placeholder="+254 7XX XXX XXX" className={inputCls(!!errors.phone)} />
                  {errors.phone && <p className="text-red-500 text-xs mt-1">{errors.phone.message}</p>}
                </div>
                <div>
                  <label className="block text-sm font-semibold text-maasai-brown dark:text-maasai-beige mb-1.5">City / Town</label>
                  <input {...register('city')} placeholder="e.g. Nairobi" className={inputCls(!!errors.city)} />
                  {errors.city && <p className="text-red-500 text-xs mt-1">{errors.city.message}</p>}
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-sm font-semibold text-maasai-brown dark:text-maasai-beige mb-1.5">Street Address</label>
                  <input {...register('address_line')} placeholder="e.g. Tom Mboya Street, Apartment 4B" className={inputCls(!!errors.address_line)} />
                  {errors.address_line && <p className="text-red-500 text-xs mt-1">{errors.address_line.message}</p>}
                </div>
                <div>
                  <label className="block text-sm font-semibold text-maasai-brown dark:text-maasai-beige mb-1.5">County</label>
                  <input {...register('county')} placeholder="e.g. Nairobi County" className={inputCls(!!errors.county)} />
                  {errors.county && <p className="text-red-500 text-xs mt-1">{errors.county.message}</p>}
                </div>
              </div>
              <div className="mt-4 flex items-start gap-2 text-sm text-maasai-brown/60 dark:text-maasai-beige/60 bg-maasai-beige/10 dark:bg-maasai-brown-light/20 rounded-xl p-3">
                <Truck className="h-4 w-4 text-maasai-terracotta flex-shrink-0 mt-0.5" />
                Delivered via G4S or Aramex Kenya. Tracking SMS sent after dispatch.
              </div>
            </div>

            {/* ── Payment ── */}
            <div className="bg-white dark:bg-maasai-brown rounded-2xl border border-maasai-beige/30 dark:border-maasai-brown-light p-4 sm:p-6">
              <h2 className="font-bold text-maasai-black dark:text-white mb-4 sm:mb-5 flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-maasai-red" /> Payment Method
              </h2>

              <div className="space-y-2.5 mb-4">
                {PAYMENT_OPTIONS.map(({ value, label, desc }) => (
                  <label key={value} className={cn(
                    'flex items-center gap-3 sm:gap-4 p-3 sm:p-4 rounded-xl border-2 cursor-pointer transition-all',
                    paymentMethod === value
                      ? 'border-maasai-red bg-maasai-red/5'
                      : 'border-maasai-beige dark:border-maasai-brown-light hover:border-maasai-red/40'
                  )}>
                    <input type="radio" value={value} {...register('payment_method')} className="w-4 h-4 accent-maasai-red flex-shrink-0" />
                    <div>
                      <p className="font-semibold text-sm text-maasai-black dark:text-white">{label}</p>
                      <p className="text-xs text-maasai-brown/60 dark:text-maasai-beige/60">{desc}</p>
                    </div>
                  </label>
                ))}
              </div>

              {/* M-Pesa phone */}
              {paymentMethod === 'mpesa' && (
                <div>
                  <label className="block text-sm font-semibold text-maasai-brown dark:text-maasai-beige mb-1.5 flex items-center gap-1.5">
                    <Phone className="h-4 w-4" /> M-Pesa Phone Number
                  </label>
                  <input {...register('mpesa_phone')} placeholder="+254 7XX XXX XXX" className={inputCls(!!errors.mpesa_phone)} />
                  {errors.mpesa_phone && <p className="text-red-500 text-xs mt-1">{errors.mpesa_phone.message}</p>}
                  <p className="text-xs text-maasai-brown/50 dark:text-maasai-beige/50 mt-1.5">You&apos;ll receive a push notification to complete payment on your phone.</p>
                </div>
              )}

              {/* Stripe info */}
              {paymentMethod === 'card' && (
                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-3 sm:p-4 text-sm text-maasai-brown/70 dark:text-maasai-beige/70 flex items-start gap-2">
                  <Smartphone className="h-4 w-4 flex-shrink-0 mt-0.5" />
                  Secure card payment powered by Stripe. Enter your card details on the next screen.
                </div>
              )}

              {/* PayPal button */}
              {paymentMethod === 'paypal' && (
                <div className="mt-2">
                  {paypalClientId ? (
                    <>
                      <p className="text-xs text-maasai-brown/60 dark:text-maasai-beige/60 mb-3 text-center">
                        Fill in your shipping details above, then click the PayPal button to pay
                      </p>
                      <PayPalScriptProvider options={{ clientId: paypalClientId, currency: 'USD', intent: 'capture' }}>
                        <PayPalButtons
                          style={{ layout: 'vertical', color: 'blue', shape: 'rect', label: 'pay' }}
                          createOrder={async () => {
                            const isValid = await trigger(['full_name', 'phone', 'address_line', 'city', 'county']);
                            if (!isValid) {
                              toast.error('Please fill in all required shipping details first');
                              throw new Error('Validation failed');
                            }
                            const newOrderId = generateOrderId();
                            pendingPaypalOrderIdRef.current = newOrderId;

                            const res = await fetch('/api/paypal/create-order', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ amount: grandTotal, orderId: newOrderId }),
                            });
                            const data = await res.json();
                            if (!res.ok) throw new Error(data.error || 'Failed to create PayPal order');
                            return data.id;
                          }}
                          onApprove={async (data) => {
                            setStep('confirming');
                            try {
                              const internalOrderId = pendingPaypalOrderIdRef.current;
                              if (!internalOrderId) throw new Error('Order ID missing');

                              const captureRes = await fetch('/api/paypal/capture-order', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ paypalOrderId: data.orderID, internalOrderId }),
                              });
                              const captureData = await captureRes.json();
                              if (!captureData.success) throw new Error('Payment capture failed');

                              const formData = getValues();
                              const supabase = createClient();
                              const payload = await buildOrderPayload(formData, 'paypal', new Date().toISOString());
                              const { error: orderError } = await supabase.from('orders').insert({ id: internalOrderId, ...payload });
                              if (orderError) throw orderError;

                              await clearCart();
                              setOrderId(internalOrderId);
                              setStep('success');
                            } catch (err: unknown) {
                              const message = err instanceof Error ? err.message : 'PayPal payment failed';
                              toast.error(message);
                              setStep('form');
                            }
                          }}
                          onError={() => {
                            toast.error('PayPal payment failed. Please try again.');
                          }}
                        />
                      </PayPalScriptProvider>
                    </>
                  ) : (
                    <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-xl p-4 text-sm text-maasai-brown/70 dark:text-maasai-beige/70 text-center">
                      PayPal is not configured. Please select another payment method.
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* ── Order Summary ── */}
          <div>
            <div className="bg-white dark:bg-maasai-brown rounded-2xl border border-maasai-beige/30 dark:border-maasai-brown-light p-4 sm:p-5 lg:sticky lg:top-24">
              <h2 className="font-bold text-maasai-black dark:text-white mb-4">Order Summary</h2>
              <div className="space-y-2 text-sm text-maasai-brown/70 dark:text-maasai-beige/70 mb-4">
                <div className="flex justify-between">
                  <span>{items.length} item{items.length !== 1 ? 's' : ''}</span>
                  <span>{formatKES(total)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Delivery</span>
                  <span className={delivery === 0 ? 'text-green-600 font-semibold' : ''}>
                    {delivery === 0 ? 'FREE' : formatKES(delivery)}
                  </span>
                </div>
              </div>
              <div className="border-t border-maasai-beige/30 dark:border-maasai-brown-light pt-3 mb-5">
                <div className="flex justify-between font-bold text-maasai-black dark:text-white text-lg">
                  <span>Total</span>
                  <span className="text-maasai-red">{formatKES(grandTotal)}</span>
                </div>
              </div>

              {paymentMethod !== 'paypal' && (
                <Button type="submit" variant="primary" size="lg" fullWidth>
                  {paymentMethod === 'mpesa'
                    ? '📱 Pay with M-Pesa'
                    : paymentMethod === 'card'
                    ? '💳 Continue to Card Payment'
                    : '✅ Place Order (COD)'}
                </Button>
              )}

              {paymentMethod === 'paypal' && (
                <p className="text-center text-xs text-maasai-brown/50 dark:text-maasai-beige/50 py-2">
                  Use the PayPal button above to complete payment
                </p>
              )}

              <div className="mt-3 flex items-center justify-center gap-1.5 text-xs text-maasai-brown/50 dark:text-maasai-beige/50">
                <ShieldCheck className="h-3.5 w-3.5" /> Secured & Protected
              </div>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
