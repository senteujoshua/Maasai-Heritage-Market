import { redirect } from 'next/navigation';

export default function SellerNewListingRedirect() {
  redirect('/vendor/listings/new');
}
