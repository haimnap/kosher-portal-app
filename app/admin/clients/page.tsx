import Link from 'next/link';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { getDictionary } from '@/lib/i18n/server';
import { ClientsTable, ClientRow } from '@/components/ClientsTable';
import { MondayClientSyncButton } from '@/components/MondayClientSyncButton';

export default async function AdminClientsPage() {
  const supabase = createClient();
  const dict = getDictionary();

  const { data: clients } = await supabase
    .from('profiles')
    .select('*, certifications!client_id(id)')
    .eq('role', 'client')
    .order('company_name');

  // Emails and login status live on auth.users, not profiles — pull them
  // once via the admin client and merge in below.
  const admin = createAdminClient();
  const { data: authUsersPage } = await admin.auth.admin.listUsers({ perPage: 1000 });
  const authById = new Map((authUsersPage?.users ?? []).map((u) => [u.id, u]));

  const rows: ClientRow[] = (clients ?? []).map((c) => {
    const authUser = authById.get(c.id);
    return {
      id: c.id,
      company_name: c.company_name,
      contact_name: c.contact_name,
      phone: c.phone,
      email: authUser?.email ?? null,
      productCount: Array.isArray(c.certifications) ? c.certifications.length : 0,
      hasLoggedIn: !!authUser?.last_sign_in_at,
    };
  });

  return (
    <div>
      <div className="flex justify-between items-center mb-6 flex-wrap gap-3">
        <h2 className="text-xl font-semibold text-brand">{dict.clients.title}</h2>
        <div className="flex items-center gap-3">
          <MondayClientSyncButton />
          <Link
            href="/admin/clients/new"
            className="px-5 py-2.5 bg-brand text-white rounded-lg text-sm font-semibold"
          >
            {dict.clients.newClient}
          </Link>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm overflow-hidden overflow-x-auto">
        <ClientsTable clients={rows} />
      </div>
    </div>
  );
}
