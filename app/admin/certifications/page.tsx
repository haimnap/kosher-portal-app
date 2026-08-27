import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { withStatus } from '@/lib/status';
import { Certification } from '@/lib/database.types';
import { AdminCertificationsTable } from '@/components/AdminCertificationsTable';
import { getDictionary } from '@/lib/i18n/server';

export default async function AdminCertificationsPage({
  searchParams,
}: {
  searchParams: { filter?: string };
}) {
  const supabase = createClient();
  const dict = getDictionary();

  const { data: rawCerts } = await supabase
    .from('certifications')
    .select('*, profiles!certifications_client_id_fkey(company_name)')
    .order('expiration_date', { ascending: true });

  const certs = ((rawCerts ?? []) as Array<Certification & { profiles: { company_name: string } | null }>).map(
    (c) => ({ ...withStatus(c), companyName: c.profiles?.company_name || 'Unknown' })
  );

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold text-brand">{dict.certifications.title}</h2>
        <Link
          href="/admin/certifications/new"
          className="px-5 py-2.5 bg-brand text-white rounded-lg text-sm font-semibold"
        >
          {dict.certifications.addCertification}
        </Link>
      </div>

      <AdminCertificationsTable certs={certs} initialFilter={searchParams.filter} />
    </div>
  );
}
