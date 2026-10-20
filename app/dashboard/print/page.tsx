import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { PortalHeader } from '@/components/PortalHeader';
import { withStatus } from '@/lib/status';
import { Certification } from '@/lib/database.types';
import { PrintSelector } from '@/components/PrintSelector';
import { getDictionary } from '@/lib/i18n/server';

export default async function PrintPage() {
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
    .eq('approval_status', 'approved')
    .order('expiration_date', { ascending: true });

  const certs = (certsRaw ?? []).map((c) => withStatus(c as Certification));

  return (
    <div className="min-h-screen bg-slate-50">
      <PortalHeader
        title={dict.print.title}
        subtitle={dict.print.subtitle}
        userName={profile?.contact_name || user.email || 'User'}
      />

      <div className="max-w-4xl mx-auto px-5 py-8">
        <PrintSelector certs={certs} companyName={profile?.company_name || 'Your Company'} />
      </div>
    </div>
  );
}
