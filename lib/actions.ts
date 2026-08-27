'use server';

import { revalidatePath } from 'next/cache';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { logAudit } from '@/lib/audit';

// ── Approve / Reject a certification ─────────────────────────
export async function approveCertification(certificationId: string) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { error } = await supabase
    .from('certifications')
    .update({
      approval_status: 'approved',
      approved_by: user.id,
      approval_date: new Date().toISOString(),
    })
    .eq('id', certificationId);

  if (error) throw new Error(error.message);

  await logAudit(supabase, {
    userId: user.id,
    action: 'certification.approved',
    entityType: 'certification',
    entityId: certificationId,
  });

  revalidatePath('/admin');
  revalidatePath('/admin/certifications');
}

export async function rejectCertification(certificationId: string, reason?: string) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { error } = await supabase
    .from('certifications')
    .update({
      approval_status: 'rejected',
      approved_by: user.id,
      approval_date: new Date().toISOString(),
      mashguiach_notes: reason ?? null,
    })
    .eq('id', certificationId);

  if (error) throw new Error(error.message);

  await logAudit(supabase, {
    userId: user.id,
    action: 'certification.rejected',
    entityType: 'certification',
    entityId: certificationId,
    details: reason ? { reason } : undefined,
  });

  revalidatePath('/admin');
  revalidatePath('/admin/certifications');
}

// ── Create a new certification ───────────────────────────────
export async function createCertification(input: {
  clientId: string;
  productName: string;
  productCategory?: string;
  certificationNumber: string;
  dateIssued?: string;
  expirationDate: string;
  mashguiachNotes?: string;
  autoApprove?: boolean;
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('certifications')
    .insert({
      client_id: input.clientId,
      product_name: input.productName,
      product_category: input.productCategory || null,
      certification_number: input.certificationNumber,
      date_issued: input.dateIssued || null,
      expiration_date: input.expirationDate,
      mashguiach_notes: input.mashguiachNotes || null,
      approval_status: input.autoApprove ? 'approved' : 'pending',
      approved_by: input.autoApprove ? user.id : null,
      approval_date: input.autoApprove ? new Date().toISOString() : null,
    })
    .select()
    .single();

  if (error) throw new Error(error.message);

  await logAudit(supabase, {
    userId: user.id,
    action: 'certification.created',
    entityType: 'certification',
    entityId: data.id,
  });

  revalidatePath('/admin');
  revalidatePath('/admin/certifications');
  return data;
}

// ── Create a new client (invites via Supabase Auth) ──────────
export async function createClientAccount(input: {
  email: string;
  companyName: string;
  contactName?: string;
  phone?: string;
  preferredLanguage?: 'es' | 'en' | 'pt';
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  // Uses the SERVICE ROLE key — required to invite users by email.
  const admin = createAdminClient();

  const { data, error } = await admin.auth.admin.inviteUserByEmail(input.email, {
    data: {
      role: 'client',
      company_name: input.companyName,
      contact_name: input.contactName || '',
      preferred_language: input.preferredLanguage || 'es',
    },
    redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/reset-password`,
  });

  if (error) throw new Error(error.message);

  // Fill in phone (not part of the invite metadata trigger)
  if (input.phone && data.user) {
    await admin.from('profiles').update({ phone: input.phone }).eq('id', data.user.id);
  }

  await logAudit(supabase, {
    userId: user.id,
    action: 'client.created',
    entityType: 'profile',
    entityId: data.user?.id,
    details: { email: input.email, company_name: input.companyName },
  });

  revalidatePath('/admin/clients');
  return data;
}
