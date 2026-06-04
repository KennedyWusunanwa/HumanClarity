import { guard } from '@/lib/admin/guard';
import { PERMISSIONS } from '@/lib/admin/roles';
import { getPricing, savePricing, validatePricingInput } from '@/lib/admin/pricing';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET → current pricing (view access).
export async function GET(request) {
  const { response } = await guard(request, PERMISSIONS.VIEW);
  if (response) return response;

  try {
    const pricing = await getPricing();
    return Response.json({ pricing });
  } catch (err) {
    return Response.json({ error: err.message || 'Could not load pricing.' }, { status: 500 });
  }
}

// PUT → update pricing (admin or editor).
export async function PUT(request) {
  const { admin, response } = await guard(request, PERMISSIONS.EDIT_PRICING);
  if (response) return response;

  try {
    const body = await request.json().catch(() => ({}));
    const errors = validatePricingInput(body);
    if (errors.length) {
      return Response.json({ error: errors.join(' ') }, { status: 400 });
    }

    const pricing = await savePricing(body, admin.username);
    return Response.json({ ok: true, pricing });
  } catch (err) {
    return Response.json({ error: err.message || 'Could not save pricing.' }, { status: 500 });
  }
}
