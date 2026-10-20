import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { PortalHeader } from '@/components/PortalHeader';
import { StatCard } from '@/components/StatCard';
import { ProductTable } from '@/components/ProductTable';
import { withStatus } from '@/lib/status';
import { Certification } from '@/lib/database.types';
import { getDictionary } from '@/lib/i18n/server';

export default async function DashboardPage() {
  const supabase = createClient();
  const dict = getDictionary();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  // Team members see their company's products, which belong to the
  // company's main account.
  const companyId = profile?.company_owner_id || user.id;

  const { data: certsRaw } = await supabase
    .from('certifications')
    .select('*')
    .eq('client_id', companyId)
    .order('expiration_date', { ascending: true });

  const certs = (certsRaw ?? []).map((c) => withStatus(c as Certification));

  const activeCount = certs.filter((c) => c.status === 'active').length;
  const expiringCount = certs.filter((c) => c.status === 'expiring_soon').length;
  const expiredCount = certs.filter((c) => c.status === 'expired').length;

  return (
    <div className="min-h-screen bg-slate-50">
      <PortalHeader
        title={profile?.company_name || 'Your Company'}
        subtitle={dict.dashboard.subtitle}
        userName={profile?.contact_name || user.email || 'User'}
      />

      <div className="max-w-6xl mx-auto px-5 py-8">
        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-10">
          <StatCard label={dict.dashboard.activeCertifications} value={activeCount} accentColor="#5cb85c" />
          <StatCard label={dict.dashboard.expiringSoon} value={expiringCount} accentColor="#ff9800" />
          <StatCard label={dict.dashboard.expired} value={expiredCount} accentColor="#dc3545" />
        </div>

        {/* Actions */}
        <div className="bg-white p-5 rounded-xl mb-8 shadow-sm flex justify-end">
          <Link
            href="/dashboard/print"
            className="px-5 py-2.5 rounded-lg text-white text-sm font-semibold"
            style={{ background: 'linear-gradient(135deg, #1a5f7a 0%, #2a8faa 100%)' }}
          >
            {dict.dashboard.printCertificates}
          </Link>
        </div>

        {/* Product Table */}
        <ProductTable certs={certs} />

        {certs.length === 0 && (
          <div className="text-center py-16 text-slate-400">
            <p>{dict.dashboard.noCerts}</p>
            <p className="text-sm mt-2">
              {dict.dashboard.contactPrefix}{' '}
              <a href="mailto:support@latinamericakosher.org" className="text-brand">
                support@latinamericakosher.org
              </a>{' '}
              {dict.dashboard.contactToStart}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
