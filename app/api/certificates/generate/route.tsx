import { NextRequest, NextResponse } from 'next/server';
import { renderToBuffer } from '@react-pdf/renderer';
import { createClient } from '@/lib/supabase/server';
import { CertificatePDF } from '@/lib/CertificatePDF';
import { logAudit } from '@/lib/audit';
import { Certification } from '@/lib/database.types';
import { isValidLang } from '@/lib/i18n/config';
import { getLang } from '@/lib/i18n/server';

// POST /api/certificates/generate
// Body: { certificationIds: string[] }
//
// Generates a multi-page PDF, one certificate per product. Row Level
// Security on the `certifications` table already ensures a client can
// only fetch their own rows — staff/admin can fetch any.
export async function POST(req: NextRequest) {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const certificationIds: string[] = body?.certificationIds;
  // Prefer the language explicitly sent by the client (matches whatever
  // they had the portal set to at the moment they clicked download);
  // fall back to their language cookie if the client didn't send one.
  const lang = isValidLang(body?.lang) ? body.lang : getLang();

  if (!Array.isArray(certificationIds) || certificationIds.length === 0) {
    return NextResponse.json({ error: 'No certifications selected' }, { status: 400 });
  }

  if (certificationIds.length > 100) {
    return NextResponse.json({ error: 'Too many certificates requested at once (max 100)' }, { status: 400 });
  }

  // RLS enforces: clients only get rows where client_id = auth.uid();
  // staff/admin get everything.
  const { data: certs, error } = await supabase
    .from('certifications')
    .select('*')
    .in('id', certificationIds)
    .eq('approval_status', 'approved');

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!certs || certs.length === 0) {
    return NextResponse.json({ error: 'No approved certifications found for the given IDs' }, { status: 404 });
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('company_name')
    .eq('id', certs[0].client_id)
    .single();

  const companyName = profile?.company_name || 'Certified Company';

  const pdfBuffer = await renderToBuffer(
    <CertificatePDF certifications={certs as Certification[]} companyName={companyName} lang={lang} />
  );

  await logAudit(supabase, {
    userId: user.id,
    action: 'certificate.printed',
    entityType: 'certification',
    details: { certificationIds, count: certs.length },
  });

  return new NextResponse(new Uint8Array(pdfBuffer), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${companyName.replace(/\s+/g, '-')}-Kosher-Certificate.pdf"`,
    },
  });
}
