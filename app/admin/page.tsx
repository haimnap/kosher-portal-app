import { createClient } from '@/lib/supabase/server';
import { StatCard } from '@/components/StatCard';
import { withStatus } from '@/lib/status';
import { Certification } from '@/lib/database.types';
import { PendingApprovalsTable } from '@/components/PendingApprovalsTable';
import { MondaySyncButton } from '@/components/MondaySyncButton';
import { SendRemindersButton } from '@/components/SendRemindersButton';
import { getDictionary } from '@/lib/i18n/server';
import Link from 'next/link';

export default async function AdminDashboardPage() {
  const supabase = createClient();
  const dict = getDictionary();

  const { count: clientCount } = await supabase
    .from('profiles')
    .select('*', { count: 'exact', head: true })
    .eq('role', 'client')
    .is('company_owner_id', null); // count companies, not people

  const { data: allCertsRaw } = await supabase
    .from('certifications')
    .select('*, profiles!certifications_client_id_fkey(company_name)')
    .order('created_at', { ascending: false });

  const allCerts = (allCertsRaw ?? []) as Array<Certification & { profiles: { company_name: string } | null }>;
  const withStatuses = allCerts.map((c) => ({ ...withStatus(c), companyName: c.profiles?.company_name || 'Unknown' }));

  const activeCount = withStatuses.filter((c) => c.status === 'active').length;
  const pendingCerts = withStatuses.filter((c) => c.approval_status === 'pending');
  const expiringSoon = withStatuses.filter((c) => c.status === 'expiring_soon');

  return (
    <div>
      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-10">
        <StatCard label={dict.admin.totalClients} value={clientCount ?? 0} accentColor="#1a5f7a" />
        <StatCard label={dict.admin.activeCerts} value={activeCount} accentColor="#5cb85c" />
        <StatCard
          label={dict.admin.pendingReview}
          value={pendingCerts.length}
          accentColor="#ff9800"
          note={pendingCerts.length > 0 ? dict.admin.actionNeeded : undefined}
          noteColor="#ff9800"
        />
        <StatCard
          label={dict.dashboard.expiringSoon}
          value={expiringSoon.length}
          accentColor="#dc3545"
          note={dict.admin.expiringSoonNote}
          noteColor="#dc3545"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_350px] gap-8">
        {/* Pending Approvals */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="bg-slate-50 px-5 py-4 border-b border-slate-200">
            <h2 className="text-base font-semibold text-brand">
              {dict.admin.pendingApprovals} ({pendingCerts.length})
            </h2>
          </div>
          <PendingApprovalsTable certs={pendingCerts.slice(0, 8)} />
          <div className="px-5 py-4 bg-slate-50 border-t border-slate-200 text-center">
            <Link href="/admin/certifications?filter=pending" className="text-sm text-brand font-semibold">
              {dict.admin.viewAllPending} ({pendingCerts.length})
            </Link>
          </div>
        </div>

        {/* Sidebar */}
        <div>
          <div className="bg-white rounded-xl p-6 shadow-sm mb-5">
            <h3 className="text-sm font-semibold text-brand mb-4">{dict.admin.quickActions}</h3>
            <Link
              href="/admin/certifications/new"
              className="block w-full text-center py-3 bg-brand text-white rounded-lg text-sm font-semibold mb-2.5"
            >
              {dict.admin.addCertification}
            </Link>
            <Link
              href="/admin/clients/new"
              className="block w-full text-center py-3 border-2 border-slate-200 text-slate-700 rounded-lg text-sm font-semibold mb-2.5"
            >
              {dict.admin.newClient}
            </Link>
            <MondaySyncButton />
            <div className="mt-2.5">
              <SendRemindersButton />
            </div>
          </div>

          {expiringSoon.length > 0 && (
            <div className="bg-amber-50 border border-amber-300 rounded-lg p-4">
              <div className="text-[13px] font-semibold text-amber-800 mb-2">{dict.admin.expiringThisWeek}</div>
              <div className="text-xs text-amber-800 space-y-1.5">
                {expiringSoon.slice(0, 5).map((c) => (
                  <div key={c.id}>
                    <strong>{c.companyName}:</strong> {c.product_name}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
