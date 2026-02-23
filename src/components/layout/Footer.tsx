import Link from 'next/link';
import { Mail, Phone, MapPin, Instagram, Facebook, Twitter } from 'lucide-react';

export function Footer() {
  return (
    <footer className="bg-maasai-black text-white relative overflow-hidden">
      <div className="h-2 bg-shuka-pattern opacity-60" />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-10">
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-maasai-gradient rounded-full flex items-center justify-center">
                <span className="text-white font-bold">MH</span>
              </div>
              <div>
                <p className="font-display font-bold text-lg leading-tight">Maasai Heritage</p>
                <p className="text-maasai-terracotta text-xs">Market</p>
              </div>
            </div>
            <p className="text-maasai-beige/70 text-sm leading-relaxed mb-4">
              Connecting Kenyan artisans with art lovers worldwide. Every purchase preserves a cultural legacy.
            </p>
            <div className="flex gap-3">
              {[Instagram, Facebook, Twitter].map((Icon, i) => (
                <a key={i} href="#" className="w-8 h-8 rounded-full bg-maasai-brown-light flex items-center justify-center hover:bg-maasai-red transition-colors">
                  <Icon className="h-4 w-4" />
                </a>
              ))}
            </div>
          </div>
          <div>
            <h3 className="font-bold text-sm uppercase tracking-wider mb-4 text-maasai-beige">Shop</h3>
            <ul className="space-y-2">
              {[
                { href: '/marketplace', label: 'All Products' },
                { href: '/auctions', label: 'Live Auctions' },
                { href: '/marketplace?category=drawings-art', label: 'Drawings & Art' },
                { href: '/marketplace?category=beaded-jewelry', label: 'Beaded Jewelry' },
                { href: '/marketplace?category=attire-clothing', label: 'Attire & Clothing' },
                { href: '/marketplace?category=shukas-textiles', label: 'Shukas & Textiles' },
              ].map(({ href, label }) => (
                <li key={href}>
                  <Link href={href} className="text-sm text-maasai-beige/70 hover:text-maasai-terracotta transition-colors">{label}</Link>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="font-bold text-sm uppercase tracking-wider mb-4 text-maasai-beige">For Sellers</h3>
            <ul className="space-y-2">
              {[
                { href: '/register?role=seller', label: 'Start Selling' },
                { href: '/seller/dashboard', label: 'Seller Dashboard' },
                { href: '/seller/listings/new', label: 'List an Item' },
              ].map(({ href, label }) => (
                <li key={href}>
                  <Link href={href} className="text-sm text-maasai-beige/70 hover:text-maasai-terracotta transition-colors">{label}</Link>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="font-bold text-sm uppercase tracking-wider mb-4 text-maasai-beige">Contact</h3>
            <ul className="space-y-3">
              <li className="flex items-start gap-2 text-sm text-maasai-beige/70">
                <MapPin className="h-4 w-4 flex-shrink-0 mt-0.5 text-maasai-terracotta" />Nairobi, Kenya
              </li>
              <li className="flex items-start gap-2 text-sm text-maasai-beige/70">
                <Mail className="h-4 w-4 flex-shrink-0 mt-0.5 text-maasai-terracotta" />support@maasaiheritage.co.ke
              </li>
              <li className="flex items-start gap-2 text-sm text-maasai-beige/70">
                <Phone className="h-4 w-4 flex-shrink-0 mt-0.5 text-maasai-terracotta" />+254 700 000 000
              </li>
            </ul>
          </div>
        </div>
        <div className="border-t border-maasai-brown-light pt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-maasai-beige/50 text-center sm:text-left">
            © {new Date().getFullYear()} Maasai Heritage Market. Made with ❤️ in Kenya. Kenya Data Protection Act 2019.
          </p>
          <div className="flex items-center gap-3 text-xs text-maasai-beige/50">
            <span>Payments by</span>
            <span className="bg-maasai-brown-light px-2 py-1 rounded font-bold text-maasai-beige">M-Pesa</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
