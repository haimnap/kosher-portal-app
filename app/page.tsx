import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

// Root route: send the visitor to the right place based on
// whether they're logged in (and their role). Middleware handles
// most of this already, but this covers the bare "/" visit.
export default async function Home() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profile?.role === 'admin' || profile?.role === 'staff') {
    redirect('/admin');
  }

  redirect('/dashboard');
}
