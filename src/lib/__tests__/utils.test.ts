import { describe, it, expect } from 'vitest';
import {
  calculateCommission,
  generateOrderId,
  sanitizePhone,
  formatKES,
  truncate,
  slugify,
} from '../utils';

// ── calculateCommission ──────────────────────────────────
describe('calculateCommission', () => {
  it('calculates 9% commission on round numbers', () => {
    const { commission, sellerAmount } = calculateCommission(1000);
    expect(commission).toBe(90);
    expect(sellerAmount).toBe(910);
    expect(commission + sellerAmount).toBe(1000);
  });

  it('rounds commission to nearest integer', () => {
    // 9% of 555 = 49.95 → rounds to 50
    const { commission } = calculateCommission(555);
    expect(commission).toBe(50);
  });

  it('uses custom commission rate', () => {
    const { commission, sellerAmount } = calculateCommission(10000, 0.05);
    expect(commission).toBe(500);
    expect(sellerAmount).toBe(9500);
  });

  it('handles zero amount', () => {
    const { commission, sellerAmount } = calculateCommission(0);
    expect(commission).toBe(0);
    expect(sellerAmount).toBe(0);
  });
});

// ── generateOrderId ───────────────────────────────────────
describe('generateOrderId', () => {
  it('starts with MHM-', () => {
    expect(generateOrderId()).toMatch(/^MHM-/);
  });

  it('produces unique IDs', () => {
    const ids = new Set(Array.from({ length: 100 }, generateOrderId));
    expect(ids.size).toBe(100);
  });

  it('contains only uppercase alphanumeric characters and dashes', () => {
    const id = generateOrderId();
    expect(id).toMatch(/^MHM-[A-Z0-9]+-[A-Z0-9]+$/);
  });
});

// ── sanitizePhone ─────────────────────────────────────────
describe('sanitizePhone', () => {
  it('converts 07XXXXXXXX to 2547XXXXXXXX', () => {
    expect(sanitizePhone('0712345678')).toBe('254712345678');
  });

  it('converts 01XXXXXXXX to 2541XXXXXXXX', () => {
    expect(sanitizePhone('0110000001')).toBe('254110000001');
  });

  it('strips leading + from +254XXXXXXXXX', () => {
    expect(sanitizePhone('+254712345678')).toBe('254712345678');
  });

  it('passes through 254XXXXXXXXX unchanged', () => {
    expect(sanitizePhone('254712345678')).toBe('254712345678');
  });

  it('strips non-digit characters', () => {
    expect(sanitizePhone('+254 712-345-678')).toBe('254712345678');
  });
});

// ── formatKES ─────────────────────────────────────────────
describe('formatKES', () => {
  it('formats whole numbers correctly', () => {
    const formatted = formatKES(1500);
    // Numeric part must be present (locale symbol varies by OS: 'KES' vs 'KSh')
    expect(formatted).toContain('1,500');
  });

  it('formats zero', () => {
    expect(formatKES(0)).toContain('0');
  });

  it('formats large amounts with thousands separator', () => {
    const formatted = formatKES(1000000);
    expect(formatted).toContain('1,000,000');
  });
});

// ── truncate ──────────────────────────────────────────────
describe('truncate', () => {
  it('returns string unchanged when shorter than limit', () => {
    expect(truncate('hello', 10)).toBe('hello');
  });

  it('returns string unchanged at exact limit', () => {
    expect(truncate('hello', 5)).toBe('hello');
  });

  it('truncates and appends ellipsis when over limit', () => {
    expect(truncate('hello world', 5)).toBe('hello…');
  });
});

// ── slugify ───────────────────────────────────────────────
describe('slugify', () => {
  it('converts spaces to hyphens', () => {
    expect(slugify('Hello World')).toBe('hello-world');
  });

  it('lowercases the string', () => {
    expect(slugify('MAASAI Shuka')).toBe('maasai-shuka');
  });

  it('removes special characters and collapses resulting hyphens', () => {
    // '&' and '!' are stripped; spaces become hyphens; consecutive hyphens collapse
    expect(slugify('Beaded & Beautiful!')).toBe('beaded-beautiful');
  });

  it('collapses consecutive hyphens', () => {
    expect(slugify('one  two')).toBe('one-two');
  });

  it('handles empty string', () => {
    expect(slugify('')).toBe('');
  });
});
