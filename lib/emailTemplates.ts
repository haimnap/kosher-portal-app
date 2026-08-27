import { dictionaries } from './i18n/dictionaries';
import { Lang } from './i18n/config';
import { formatDateLong } from './i18n/format';

export interface ReminderItem {
  productName: string;
  certificationNumber: string;
  expirationDate: string; // ISO date
  daysRemaining: number;
}

// Renders the "your certifications are expiring soon" email, in the
// client's preferred language. Plain, table-based HTML — renders
// reliably across every email client, no external stylesheet needed.
export function renderReminderEmail({
  lang,
  companyName,
  items,
  portalUrl,
}: {
  lang: Lang;
  companyName: string;
  items: ReminderItem[];
  portalUrl: string;
}): { subject: string; html: string } {
  const t = dictionaries[lang].email;

  const rows = items
    .map(
      (item) => `
        <tr>
          <td style="padding:12px 16px;border-bottom:1px solid #eef2f5;font-size:14px;color:#1a1a1a;font-weight:600;">
            ${escapeHtml(item.productName)}
          </td>
          <td style="padding:12px 16px;border-bottom:1px solid #eef2f5;font-size:13px;color:#666;">
            ${escapeHtml(item.certificationNumber)}
          </td>
          <td style="padding:12px 16px;border-bottom:1px solid #eef2f5;font-size:13px;color:#666;">
            ${t.reminderExpiresOn} ${formatDateLong(item.expirationDate, lang)}
          </td>
          <td style="padding:12px 16px;border-bottom:1px solid #eef2f5;font-size:13px;color:#dc3545;font-weight:600;white-space:nowrap;">
            ${item.daysRemaining} ${item.daysRemaining === 1 ? t.reminderDayLeft : t.reminderDaysLeft}
          </td>
        </tr>`
    )
    .join('');

  const html = `
    <!doctype html>
    <html lang="${lang}">
      <body style="margin:0;padding:0;background:#f5f7fa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f7fa;padding:40px 20px;">
          <tr>
            <td align="center">
              <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;max-width:600px;width:100%;">
                <tr>
                  <td style="background:linear-gradient(135deg,#1a5f7a 0%,#2a8faa 100%);padding:32px 40px;">
                    <div style="font-size:28px;margin-bottom:8px;">🕎</div>
                    <div style="color:#ffffff;font-size:18px;font-weight:600;">Latin America Kosher</div>
                  </td>
                </tr>
                <tr>
                  <td style="padding:32px 40px;">
                    <p style="font-size:15px;color:#1a1a1a;margin:0 0 16px;">
                      ${t.reminderGreeting} ${escapeHtml(companyName)},
                    </p>
                    <p style="font-size:14px;color:#555;line-height:1.6;margin:0 0 24px;">
                      ${t.reminderIntro}
                    </p>
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #eef2f5;border-radius:8px;overflow:hidden;">
                      ${rows}
                    </table>
                    <p style="font-size:14px;color:#555;line-height:1.6;margin:24px 0;">
                      ${t.reminderClosing}
                    </p>
                    <table role="presentation" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="border-radius:8px;background:linear-gradient(135deg,#1a5f7a 0%,#2a8faa 100%);">
                          <a href="${portalUrl}" style="display:inline-block;padding:12px 28px;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;">
                            ${t.reminderCta}
                          </a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding:20px 40px;background:#f8fbfc;border-top:1px solid #eef2f5;">
                    <p style="font-size:12px;color:#999;margin:0;">${t.reminderFooter}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
    </html>`;

  return { subject: t.reminderSubject, html };
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
