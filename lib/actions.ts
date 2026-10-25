'use server';

import { revalidatePath } from 'next/cache';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { logAudit } from '@/lib/audit';
import { isExcludedClientEmail } from '@/lib/client-email-filter';
import { transferCompanyOwnership } from '@/lib/company-accounts';

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

// ── Resend an activation email to an existing client ──────────
// Used for accounts that were created without an email going out yet
// (e.g. imported from Monday.com) — sends a "set your password" link
// pointed at our own /reset-password page, so it works reliably instead
// of depending on Supabase's dashboard-triggered email (which ignores
// our custom redirect and can send people to the wrong page).
export async function resendClientInvite(email: string) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (profile?.role !== 'admin' && profile?.role !== 'staff') throw new Error('Not authorized');

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/reset-password`,
  });

  if (error) throw new Error(error.message);

  await logAudit(supabase, {
    userId: user.id,
    action: 'client.invite_resent',
    entityType: 'profile',
    details: { email },
  });
}

// ── Remove one person's portal login ─────────────────────────
// Used from the Clients page and the Monday sync result. Deletes that
// person's login only — never a company's products:
//   * a team member is simply removed;
//   * if it's the company's main account and other people remain, one of
//     them first becomes the main account (products move with it);
//   * the last login of a company that still has products is refused.
// Returns a result instead of throwing so the page can show the message.
export async function removeClientPerson(userId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Not authenticated' };

  const { data: me } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (me?.role !== 'admin' && me?.role !== 'staff') return { ok: false, error: 'Not authorized' };

  const admin = createAdminClient();

  const { data: target } = await admin
    .from('profiles')
    .select('id, role, company_name, company_owner_id')
    .eq('id', userId)
    .maybeSingle();
  if (!target) return { ok: true }; // already gone
  if (target.role !== 'client') return { ok: false, error: 'Only client logins can be removed here.' };

  const { data: authUser } = await admin.auth.admin.getUserById(userId);
  const email = authUser?.user?.email ?? null;

  try {
    if (!target.company_owner_id) {
      const { data: members } = await admin
        .from('profiles')
        .select('id, created_at')
        .eq('company_owner_id', userId)
        .order('created_at');

      if (members && members.length > 0) {
        // Prefer a member whose address may have a client login.
        let newOwnerId = members[0].id as string;
        for (const m of members) {
          const { data: mu } = await admin.auth.admin.getUserById(m.id as string);
          const memberEmail = mu?.user?.email;
          if (memberEmail && !isExcludedClientEmail(memberEmail)) {
            newOwnerId = m.id as string;
            break;
          }
        }
        await transferCompanyOwnership(admin, userId, newOwnerId);
      } else {
        const { count } = await admin
          .from('certifications')
          .select('id', { count: 'exact', head: true })
          .eq('client_id', userId);
        if (count && count > 0) {
          return {
            ok: false,
            error: `This is the only login of ${target.company_name ?? 'this company'}, which has ${count} product(s). Add another person to the company first.`,
          };
        }
      }
    }

    const { error } = await admin.auth.admin.deleteUser(userId);
    if (error) return { ok: false, error: error.message };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Could not remove this login' };
  }

  await logAudit(supabase, {
    userId: user.id,
    action: 'client.login_removed',
    entityType: 'profile',
    entityId: userId,
    details: { email, company_name: target.company_name },
  });

  revalidatePath('/admin/clients');
  return { ok: true };
}
