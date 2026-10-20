import Link from 'next/link';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { getDictionary } from '@/lib/i18n/server';
import { ClientsTable, ClientRow, ClientPerson } from '@/components/ClientsTable';
import { MondayClientSyncButton } from '@/components/MondayClientSyncButton';

export default async function AdminClientsPage() {
  const supabase = createClient();
  const dict = getDictionary();

  // `certifications!client_id` = count products via certifications.client_id
  // (certifications has two links to profiles, so it must be named).
  const { data: clients, error } = await supabase
    .from('profiles')
    .select('*, certifications!client_id(id)')
    .eq('role', 'client')
    .order('company_name');

  if (error) {
    console.error('[admin/clients] failed to load clients:', error.message);
  }

  // Emails and login status live on auth.users, not profiles — pull them
  // once via the admin client and merge in below.
  const admin = createAdminClient();
  const { data: authUsersPage } = await admin.auth.admin.listUsers({ perPage: 1000 });
  const authById = new Map((authUsersPage?.users ?? []).map((u) => [u.id, u]));

  const all = clients ?? [];
  const toPerson = (p: (typeof all)[number], isMain: boolean): ClientPerson => {
    const authUser = authById.get(p.id);
    return {
      id: p.id,
      name: p.contact_name,
      email: authUser?.email ?? null,
      hasLoggedIn: !!authUser?.last_sign_in_at,
      isMain,
    };
  };

  // Main company accounts have no company_owner_id; team members point at
  // their company's main account.
  const membersByOwner = new Map<string, typeof all>();
  for (const p of all) {
    if (!p.company_owner_id) continue;
    const list = membersByOwner.get(p.company_owner_id) ?? [];
    list.push(p);
    membersByOwner.set(p.company_owner_id, list);
  }

  const rows: ClientRow[] = all
    .filter((c) => !c.company_owner_id)
    .map((c) => ({
      id: c.id,
      company_name: c.company_name,
      phone: c.phone,
      productCount: Array.isArray(c.certifications) ? c.certifications.length : 0,
      people: [toPerson(c, true), ...(membersByOwner.get(c.id) ?? []).map((m) => toPerson(m, false))],
    }));

  return (
    <div>
      <div className="flex justify-between items-start mb-6 flex-wrap gap-3">
        <h2 className="text-xl font-semibold text-brand">{dict.clients.title}</h2>
        <div className="flex items-start gap-3">
          <MondayClientSyncButton />
          <Link
            href="/admin/clients/new"
            className="px-5 py-2.5 bg-brand text-white rounded-lg text-sm font-semibold whitespace-nowrap"
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
