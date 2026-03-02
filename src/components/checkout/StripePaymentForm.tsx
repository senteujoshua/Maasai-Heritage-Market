'use client';
import { useState } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { Button } from '@/components/ui/Button';
import { formatKES } from '@/lib/utils';
import { Loader2, Lock, ChevronLeft } from 'lucide-react';

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

interface Props {
  clientSecret: string;
  amount: number;
  onSuccess: () => void;
  onError: (message: string) => void;
  onBack: () => void;
}

function CardForm({ amount, onSuccess, onError, onBack }: Omit<Props, 'clientSecret'>) {
  const stripe = useStripe();
  const elements = useElements();
  const [processing, setProcessing] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!stripe || !elements) return;
    setProcessing(true);

    const { error, paymentIntent } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/orders`,
      },
      redirect: 'if_required',
    });

    if (error) {
      onError(error.message || 'Payment failed. Please try again.');
    } else if (paymentIntent?.status === 'succeeded') {
      onSuccess();
    }
    setProcessing(false);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="border-2 border-maasai-beige dark:border-maasai-brown-light rounded-xl p-4 bg-white dark:bg-maasai-brown">
        <PaymentElement
          options={{
            layout: 'tabs',
            fields: { billingDetails: { address: 'never' } },
          }}
        />
      </div>
      <div className="flex gap-3">
        <Button type="button" variant="outline" size="lg" onClick={onBack} className="flex-shrink-0">
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button type="submit" variant="primary" size="lg" fullWidth disabled={!stripe || processing}>
          {processing
            ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Processing...</>
            : `💳 Pay ${formatKES(amount)}`}
        </Button>
      </div>
      <div className="flex items-center justify-center gap-1.5 text-xs text-maasai-brown/50 dark:text-maasai-beige/50">
        <Lock className="h-3 w-3" /> Secured by Stripe — your card details are encrypted
      </div>
    </form>
  );
}

export function StripePaymentForm({ clientSecret, amount, onSuccess, onError, onBack }: Props) {
  return (
    <Elements
      stripe={stripePromise}
      options={{
        clientSecret,
        appearance: {
          theme: 'stripe',
          variables: { colorPrimary: '#6D001A' },
        },
      }}
    >
      <CardForm amount={amount} onSuccess={onSuccess} onError={onError} onBack={onBack} />
    </Elements>
  );
}
