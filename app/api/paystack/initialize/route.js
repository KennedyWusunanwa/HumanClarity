export async function POST(request) {
  try {
    const secretKey = process.env.PAYSTACK_SECRET_KEY;

    if (!secretKey) {
      return Response.json(
        { error: 'PAYSTACK_SECRET_KEY is not set.' },
        { status: 503 },
      );
    }

    const { email, name, callbackUrl } = await request.json();

    if (!email?.trim()) {
      return Response.json({ error: 'Email is required.' }, { status: 400 });
    }

    const reference = `hc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    const res = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${secretKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: email.trim(),
        amount: '5000',
        currency: 'GHS',
        reference,
        callback_url: callbackUrl,
        metadata: {
          product: 'HumanClarity Pro Monthly',
          customer_name: name?.trim() || '',
          plan: 'pro',
        },
      }),
    });

    const data = await res.json();

    if (!res.ok || !data.status) {
      return Response.json(
        { error: data.message || 'Could not initialize payment.' },
        { status: res.status || 500 },
      );
    }

    return Response.json({
      authorization_url: data.data.authorization_url,
      access_code: data.data.access_code,
      reference: data.data.reference,
    });
  } catch (error) {
    return Response.json(
      { error: error.message || 'Could not initialize payment.' },
      { status: 500 },
    );
  }
}
