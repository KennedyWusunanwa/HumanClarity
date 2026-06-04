import { getPricing, DEFAULT_PRICING } from '@/lib/admin/pricing';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Public, unauthenticated read of the current subscription pricing so the
// storefront/app can show the live price and bill the right amount. Falls back
// to defaults if the admin backend isn't configured yet — never errors.
export async function GET() {
  let pricing;
  try {
    pricing = await getPricing();
  } catch {
    pricing = { ...DEFAULT_PRICING };
  }

  return Response.json(
    {
      proPriceGhs: pricing.proPriceGhs,
      proPriceUsdEstimate: pricing.proPriceUsdEstimate,
      currency: pricing.currency,
      freeWordLimit: pricing.freeWordLimit,
      billingPeriod: pricing.billingPeriod,
    },
    { headers: { 'Cache-Control': 'public, max-age=60, stale-while-revalidate=300' } },
  );
}
