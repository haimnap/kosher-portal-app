// Monday.com → Portal client import
//
// Pulls company records from your Monday CRM ("Customer Companies" board)
// so they can be created as client accounts in the portal. This is a
// SEPARATE board/flow from lib/monday.ts (which syncs product
// certifications) — this one is about the client list itself.
//
// The email used for each client is taken from the first linked contact
// (on your Monday "Contacts" board) that has an email filled in. If none
// of the linked contacts have an email, we fall back to the company
// record's own "E-MAIL" column.
//
// SETUP — see README.md "Connecting Monday.com": set MONDAY_CLIENTS_BOARD_ID
// to your Customer Companies board's ID (find it in the board's URL).

import { mondayRequest } from './monday';

const COMPANY_NAME_COLUMN = 'text_mktb30h4';
const COMPANY_EMAIL_COLUMN = 'email_mm332crr';
const CONTACT_LINK_COLUMN = 'account_contact';
const CONTACT_EMAIL_COLUMN = 'email_mm30yew';

// Groups to skip entirely — e.g. an "Inactive"/"INACTIVOS" group of old
// or churned accounts that shouldn't get portal logins.
const EXCLUDED_GROUP_IDS = new Set([process.env.MONDAY_CLIENTS_EXCLUDED_GROUP_ID || 'group_mkw4wmym']);

interface RawColumnValue {
  id: string;
  text: string | null;
  value: string | null;
}

interface RawCompanyItem {
  id: string;
  name: string;
  group: { id: string; title: string };
  column_values: RawColumnValue[];
}

export interface MondayClientRecord {
  monday_item_id: string;
  company_name: string | null;
  email: string | null;
  group_title: string;
}

function getColumn(item: RawCompanyItem, columnId: string): RawColumnValue | undefined {
  return item.column_values.find((cv) => cv.id === columnId);
}

// Monday's "board relation" columns store their linked item ids as a JSON
// string in `value`, e.g. {"linkedPulseIds":[{"linkedPulseId":123}]}.
function extractLinkedIds(column: RawColumnValue | undefined): string[] {
  if (!column?.value) return [];
  try {
    const parsed = JSON.parse(column.value) as { linkedPulseIds?: { linkedPulseId: number }[] };
    return (parsed.linkedPulseIds ?? []).map((x) => String(x.linkedPulseId));
  } catch {
    return [];
  }
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function fetchCompanyItems(boardId: string): Promise<RawCompanyItem[]> {
  const query = `
    query ($boardId: [ID!]) {
      boards(ids: $boardId) {
        items_page(limit: 200) {
          items {
            id
            name
            group { id title }
            column_values(ids: ["${COMPANY_NAME_COLUMN}", "${COMPANY_EMAIL_COLUMN}", "${CONTACT_LINK_COLUMN}"]) {
              id
              text
              value
            }
          }
        }
      }
    }
  `;
  const data = await mondayRequest<{ boards: { items_page: { items: RawCompanyItem[] } }[] }>(query, {
    boardId: [boardId],
  });
  return data.boards?.[0]?.items_page?.items ?? [];
}

// Batch-fetches the "E-mail" column for a set of Contacts-board item ids,
// regardless of which board the company items live on.
async function fetchContactEmails(contactIds: string[]): Promise<Map<string, string>> {
  const emailMap = new Map<string, string>();
  if (contactIds.length === 0) return emailMap;

  for (const batch of chunk(contactIds, 90)) {
    const query = `
      query ($ids: [ID!]) {
        items(ids: $ids) {
          id
          column_values(ids: ["${CONTACT_EMAIL_COLUMN}"]) {
            text
          }
        }
      }
    `;
    const data = await mondayRequest<{ items: { id: string; column_values: { text: string | null }[] }[] }>(
      query,
      { ids: batch }
    );
    for (const item of data.items ?? []) {
      const email = item.column_values?.[0]?.text;
      if (email) emailMap.set(item.id, email.trim());
    }
  }

  return emailMap;
}

export async function fetchClientRecords(): Promise<MondayClientRecord[]> {
  const boardId = process.env.MONDAY_CLIENTS_BOARD_ID;
  if (!boardId) throw new Error('MONDAY_CLIENTS_BOARD_ID is not set');

  const companies = await fetchCompanyItems(boardId);
  const active = companies.filter((c) => !EXCLUDED_GROUP_IDS.has(c.group?.id));

  const allContactIds = new Set<string>();
  const linkedIdsByCompany = new Map<string, string[]>();
  for (const company of active) {
    const ids = extractLinkedIds(getColumn(company, CONTACT_LINK_COLUMN));
    linkedIdsByCompany.set(company.id, ids);
    ids.forEach((id) => allContactIds.add(id));
  }

  const contactEmails = await fetchContactEmails(Array.from(allContactIds));

  return active.map((company) => {
    const name = getColumn(company, COMPANY_NAME_COLUMN)?.text?.trim() || null;
    const companyEmail = getColumn(company, COMPANY_EMAIL_COLUMN)?.text?.trim() || null;

    const linkedIds = linkedIdsByCompany.get(company.id) ?? [];
    let contactEmail: string | null = null;
    for (const id of linkedIds) {
      const email = contactEmails.get(id);
      if (email) {
        contactEmail = email;
        break;
      }
    }

    return {
      monday_item_id: company.id,
      company_name: name,
      email: contactEmail || companyEmail,
      group_title: company.group?.title ?? '',
    };
  });
}
