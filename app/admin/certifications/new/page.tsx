import { createClient } from '@/lib/supabase/server';
import { NewCertificationForm } from '@/components/NewCertificationForm';
import { getDictionary } from '@/lib/i18n/server';

export default async function NewCertificationPage() {
  const supabase = createClient();
  const dict = getDictionary();
  const { data: clients } = await supabase
    .from('profiles')
    .select('id, company_name')
    .eq('role', 'client')
    .order('company_name');

  return (
    <div className="max-w-2xl">
      <h2 className="text-xl font-semibold text-brand mb-6">{dict.certifications.new.title}</h2>
      <NewCertificationForm clients={clients ?? []} />
    </div>
  );
}
