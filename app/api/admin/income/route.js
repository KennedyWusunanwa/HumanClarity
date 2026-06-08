import { guard } from '@/lib/admin/guard';
import { PERMISSIONS } from '@/lib/admin/roles';
import { listAllUsers } from '@/lib/admin/service';
import { getPricing } from '@/lib/admin/pricing';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/admin/income
// Income overview for the admin/accountant. Distinguishes:
//   - premium users     : everyone on the Pro tier (includes admin-granted/comped)
//   - paid subscribers  : premium users with a real Paystack payment on record
//   - comped premium    : premium users with no payment (admin-granted or legacy)
// Revenue is the sum of recorded paid amounts; legacy payers without a recorded
// amount are estimated at the current Pro price (flagged separately so the figure
// is honest about what's measured vs estimated).
export async function GET(request) {
  const { response } = await guard(request, PERMISSIONS.VIEW_FINANCE);
  if (response) return response;

  try {
    const [users, pricing] = await Promise.all([listAllUsers(), getPricing()]);

    const proPrice = Number(pricing.proPriceGhs) || 0;
    const currency = pricing.currency || 'GHS';

    const premium = users.filter((u) => u.isPremium);
    // A real payment is identified by a Paystack reference on the account.
    const paid = premium.filter((u) => !!u.lastPaymentReference);
    const comped = premium.filter((u) => !u.lastPaymentReference); // admin-granted / legacy

    let recorded = 0;
    let recordedCount = 0;
    let estimatedCount = 0;
    for (const u of paid) {
      if (Number.isFinite(u.amountPaid) && u.amountPaid > 0) {
        recorded += u.amountPaid;
        recordedCount += 1;
      } else {
        estimatedCount += 1;
      }
    }
    const estimated = estimatedCount * proPrice;
    const totalRevenue = recorded + estimated;

    const recentPayments = paid
      .slice()
      .sort((a, b) => new Date(b.upgradedAt || 0) - new Date(a.upgradedAt || 0))
      .slice(0, 25)
      .map((u) => ({
        email: u.email,
        name: u.name,
        amount: Number.isFinite(u.amountPaid) && u.amountPaid > 0 ? u.amountPaid : null,
        currency: u.paymentCurrency || currency,
        upgradedAt: u.upgradedAt || '',
        reference: u.lastPaymentReference || '',
        estimated: !(Number.isFinite(u.amountPaid) && u.amountPaid > 0),
      }));

    return Response.json({
      currency,
      proPrice,
      billingPeriod: pricing.billingPeriod || 'month',
      counts: {
        totalUsers: users.length,
        free: users.length - premium.length,
        premium: premium.length,
        paid: paid.length,
        comped: comped.length,
      },
      revenue: {
        total: totalRevenue, // recorded + estimated, in `currency`
        recorded, // sum of actual recorded payment amounts
        recordedCount, // paid users with a recorded amount
        estimated, // estimatedCount * current price
        estimatedCount, // paid users without a recorded amount (legacy)
      },
      recentPayments,
    });
  } catch (err) {
    const setupHint = /service_role|SUPABASE_SERVICE_ROLE_KEY/i.test(err?.message || '');
    return Response.json(
      { error: err.message || 'Could not load income.', setupError: setupHint },
      { status: 500 },
    );
  }
}
