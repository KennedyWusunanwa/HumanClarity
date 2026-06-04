import { getConfig, setConfig } from './service.js';

export const PRICING_KEY = 'pricing';

// Must match the seed in supabase/admin-schema.sql and the historical hard-coded
// values, so checkout/UI keep working even before the admin edits anything.
export const DEFAULT_PRICING = {
  proPriceGhs: 50,
  proPriceUsdEstimate: 4.44,
  currency: 'GHS',
  freeWordLimit: 500,
  billingPeriod: 'month',
};

export function normalizePricing(value) {
  const v = value || {};
  const num = (x, fallback) => {
    const n = Number(x);
    return Number.isFinite(n) && n >= 0 ? n : fallback;
  };
  return {
    proPriceGhs: num(v.proPriceGhs, DEFAULT_PRICING.proPriceGhs),
    proPriceUsdEstimate: num(v.proPriceUsdEstimate, DEFAULT_PRICING.proPriceUsdEstimate),
    currency: typeof v.currency === 'string' && v.currency.trim() ? v.currency.trim().toUpperCase() : DEFAULT_PRICING.currency,
    freeWordLimit: Math.round(num(v.freeWordLimit, DEFAULT_PRICING.freeWordLimit)),
    billingPeriod: typeof v.billingPeriod === 'string' && v.billingPeriod.trim() ? v.billingPeriod.trim() : DEFAULT_PRICING.billingPeriod,
  };
}

// Reads pricing from app_config, falling back to defaults if the row/table is
// missing. Never throws on a missing config — only on hard infra errors.
export async function getPricing() {
  try {
    const value = await getConfig(PRICING_KEY);
    return normalizePricing(value ?? DEFAULT_PRICING);
  } catch (err) {
    // If the table doesn't exist yet, degrade to defaults rather than 500.
    if (/relation .*app_config.* does not exist/i.test(err?.message || '')) {
      return { ...DEFAULT_PRICING };
    }
    throw err;
  }
}

// Validate + persist. Returns the normalized, saved pricing.
export function validatePricingInput(input) {
  const errors = [];
  const ghs = Number(input?.proPriceGhs);
  if (!Number.isFinite(ghs) || ghs < 0) errors.push('Pro price (GHS) must be a number ≥ 0.');
  if (ghs > 100000) errors.push('Pro price (GHS) is unreasonably large.');

  const limit = Number(input?.freeWordLimit);
  if (!Number.isFinite(limit) || limit < 0) errors.push('Free word limit must be a number ≥ 0.');
  if (limit > 1000000) errors.push('Free word limit is unreasonably large.');

  if (input?.proPriceUsdEstimate != null) {
    const usd = Number(input.proPriceUsdEstimate);
    if (!Number.isFinite(usd) || usd < 0) errors.push('USD estimate must be a number ≥ 0.');
  }
  return errors;
}

export async function savePricing(input, updatedBy) {
  const normalized = normalizePricing(input);
  const saved = await setConfig(PRICING_KEY, normalized, updatedBy);
  return normalizePricing(saved);
}
