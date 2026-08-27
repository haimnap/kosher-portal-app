import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { getDictionary } from '@/lib/i18n/server';

export default async function AdminClientsPage() {
  const supabase = createClient();
  const dict = getDictionary();

  const { data: clients } = await supabase
    .from('profiles')
    .select('*, certifications(id)')
    .eq('role', 'client')
    .order('company_name');

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold text-brand">{dict.clients.title}</h2>
        <Link
          href="/admin/clients/new"
          className="px-5 py-2.5 bg-brand text-white rounded-lg text-sm font-semibold"
        >
          {dict.clients.newClient}
        </Link>
      </div>

      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b-2 border-slate-200">
              <th className="px-5 py-3 text-left text-xs text-slate-400 font-semibold uppercase">{dict.clients.company}</th>
              <th className="px-5 py-3 text-left text-xs text-slate-400 font-semibold uppercase">{dict.clients.contact}</th>
              <th className="px-5 py-3 text-left text-xs text-slate-400 font-semibold uppercase">{dict.clients.phone}</th>
              <th className="px-5 py-3 text-center text-xs text-slate-400 font-semibold uppercase">{dict.clients.products}</th>
            </tr>
          </thead>
          <tbody>
            {(clients ?? []).map((c) => (
              <tr key={c.id} className="border-b border-slate-100 hover:bg-slate-50">
                <td className="px-5 py-3.5 text-sm font-medium text-slate-900">{c.company_name || '—'}</td>
                <td className="px-5 py-3.5 text-sm text-slate-600">{c.contact_name || '—'}</td>
                <td className="px-5 py-3.5 text-sm text-slate-600">{c.phone || '—'}</td>
                <td className="px-5 py-3.5 text-sm text-center text-slate-600">
                  {Array.isArray(c.certifications) ? c.certifications.length : 0}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {(clients ?? []).length === 0 && (
          <div className="p-8 text-center text-slate-400 text-sm">{dict.clients.none}</div>
        )}
      </div>
    </div>
  );
}
