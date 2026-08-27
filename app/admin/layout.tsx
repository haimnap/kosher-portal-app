import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { AdminNav } from '@/components/AdminNav';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, contact_name')
    .eq('id', user.id)
    .single();

  if (profile?.role !== 'admin' && profile?.role !== 'staff') {
    redirect('/dashboard');
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <AdminNav userName={profile?.contact_name || user.email || 'Staff'} />
      <div className="max-w-[1400px] mx-auto px-5 py-8">{children}</div>
    </div>
  );
}
