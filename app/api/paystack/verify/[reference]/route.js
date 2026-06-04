import { getPricing, DEFAULT_PRICING } from '@/lib/admin/pricing';

export async function GET(_request, { params }) {
  try {
    const secretKey = process.env.PAYSTACK_SECRET_KEY;

    if (!secretKey) {
      return Response.json(
        { error: 'PAYSTACK_SECRET_KEY is not set.' },
        { status: 503 },
      );
    }

    const { reference } = await params;

    if (!reference) {
      return Response.json({ error: 'Payment reference is required.' }, { status: 400 });
    }

    const res = await fetch(
      `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
      {
        headers: {
          Authorization: `Bearer ${secretKey}`,
        },
        cache: 'no-store',
      },
    );

    const data = await res.json();

    if (!res.ok || !data.status) {
      return Response.json(
        { error: data.message || 'Could not verify payment.' },
        { status: res.status || 500 },
      );
    }

    // Decide whether this charge covered the Pro price SERVER-side, using the live
    // admin-set price (falling back to the default). This avoids trusting a stale
    // client-cached price, which could wrongly reject a real payer after a price cut.
    let expectedPesewas = Math.round(Number(DEFAULT_PRICING.proPriceGhs) * 100);
    let expectedCurrency = DEFAULT_PRICING.currency;
    try {
      const pricing = await getPricing();
      const p = Math.round(Number(pricing.proPriceGhs) * 100);
      if (Number.isFinite(p) && p > 0) expectedPesewas = p;
      if (pricing.currency) expectedCurrency = pricing.currency;
    } catch {
      // keep defaults
    }

    const paidAmount = Number(data.data.amount);
    const meetsPrice =
      Number.isFinite(paidAmount) &&
      paidAmount >= expectedPesewas &&
      data.data.currency === expectedCurrency;

    return Response.json({
      status: data.data.status,
      amount: data.data.amount,
      currency: data.data.currency,
      paid_at: data.data.paid_at,
      reference: data.data.reference,
      customer_email: data.data.customer?.email || '',
      meetsPrice,
      expectedAmount: expectedPesewas,
    });
  } catch (error) {
    return Response.json(
      { error: error.message || 'Could not verify payment.' },
      { status: 500 },
    );
  }
}
