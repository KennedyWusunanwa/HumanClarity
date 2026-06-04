async function fetchPaystack(url, secretKey) {
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${secretKey}`,
    },
    cache: 'no-store',
  });

  const data = await res.json();
  return { res, data };
}

// Floor (in pesewas) below which a "Pro" charge is treated as a test/trivial
// payment rather than a real purchase. We deliberately do NOT require the exact
// current price here: the price is admin-editable, so a genuine past payer must
// still be restored even after the price changes. The plan/product metadata is
// set server-side by our initialize route, so it can't be forged by end users.
const RESTORE_MIN_PESEWAS = 100; // 1.00 GHS

function findMatchingUpgrade(transactions) {
  if (!Array.isArray(transactions)) return null;

  return transactions.find((transaction) => {
    const metadata = transaction?.metadata || {};
    const product = String(metadata.product || '').toLowerCase();
    const plan = String(metadata.plan || '').toLowerCase();

    return (
      transaction?.status === 'success' &&
      Number(transaction?.amount || 0) >= RESTORE_MIN_PESEWAS &&
      (plan === 'pro' || product.includes('humanclarity pro monthly'))
    );
  }) || null;
}

export async function POST(request) {
  try {
    const secretKey = process.env.PAYSTACK_SECRET_KEY;

    if (!secretKey) {
      return Response.json(
        { error: 'PAYSTACK_SECRET_KEY is not set.' },
        { status: 503 },
      );
    }

    const { email } = await request.json();

    if (!email?.trim()) {
      return Response.json({ error: 'Email is required.' }, { status: 400 });
    }

    const customerLookup = await fetchPaystack(
      `https://api.paystack.co/customer/${encodeURIComponent(email.trim())}`,
      secretKey,
    );

    if (customerLookup.res.status === 404) {
      return Response.json({ restored: false });
    }

    if (!customerLookup.res.ok || !customerLookup.data.status) {
      return Response.json(
        { error: customerLookup.data.message || 'Could not fetch customer.' },
        { status: customerLookup.res.status || 500 },
      );
    }

    const customerId = customerLookup.data.data?.id;

    if (!customerId) {
      return Response.json({ restored: false });
    }

    const transactionLookup = await fetchPaystack(
      `https://api.paystack.co/transaction?status=success&customer=${encodeURIComponent(customerId)}&perPage=20`,
      secretKey,
    );

    if (!transactionLookup.res.ok || !transactionLookup.data.status) {
      return Response.json(
        { error: transactionLookup.data.message || 'Could not fetch transactions.' },
        { status: transactionLookup.res.status || 500 },
      );
    }

    const match = findMatchingUpgrade(transactionLookup.data.data);

    if (!match) {
      return Response.json({ restored: false });
    }

    return Response.json({
      restored: true,
      reference: match.reference,
      paid_at: match.paid_at,
      amount: match.amount,
      currency: match.currency,
    });
  } catch (error) {
    return Response.json(
      { error: error.message || 'Could not restore premium status.' },
      { status: 500 },
    );
  }
}
