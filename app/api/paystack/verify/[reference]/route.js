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

    return Response.json({
      status: data.data.status,
      amount: data.data.amount,
      currency: data.data.currency,
      paid_at: data.data.paid_at,
      reference: data.data.reference,
      customer_email: data.data.customer?.email || '',
    });
  } catch (error) {
    return Response.json(
      { error: error.message || 'Could not verify payment.' },
      { status: 500 },
    );
  }
}
