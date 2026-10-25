// Monday.com → Portal client import
//
// Pulls company records from your Monday CRM ("Customer Companies" board)
// so they can be created as client accounts in the portal. This is a
// SEPARATE board/flow from lib/monday.ts (which syncs product
// certifications) — this one is about the client list itself.
//
// Every person connected to a company in its "Contacts" column (on your
// Monday "Contacts" board) who has an email filled in becomes a person
// with their own portal login for that company. The company's own
// "E-MAIL" column is deliberately NOT used.
//
// SETUP — see README.md "Connecting Monday.com": set MONDAY_CLIENTS_BOARD_ID
// to your Customer Companies board's ID (find it in the board's URL).

import { mondayRequest } from './monday';

const COMPANY_NAME_COLUMN = 'text_mktb30h4';
const CONTACT_LINK_COLUMN = 'account_contact';
const CONTACT_EMAIL_COLUMN = 'email_mm30yew';

// Groups to skip entirely — e.g. an "Inactive"/"INACTIVOS" group of old
// or churned accounts that shouldn't get portal logins.
const EXCLUDED_GROUP_IDS = new Set([process.env.MONDAY_CLIENTS_EXCLUDED_GROUP_ID || 'group_mkw4wmym']);

interface RawColumnValue {
  id: string;
  text: string | null;
  value: string | null;
  // Only present on board-relation columns (newer Monday API versions
  // return value = null for these and expose the ids here instead).
  linked_item_ids?: string[] | null;
}

interface RawCompanyItem {
  id: string;
  name: string;
  group: { id: string; title: string };
  column_values: RawColumnValue[];
}

export interface MondayContact {
  email: string; // lower-cased
  name: string | null;
}

export interface MondayClientRecord {
  monday_item_id: string;
  company_name: string | null;
  // Every connected contact that has an email, in Monday's order, with
  // duplicate emails removed.
  contacts: MondayContact[];
  group_title: string;
}

function getColumn(item: RawCompanyItem, columnId: string): RawColumnValue | undefined {
  return item.column_values.find((cv) => cv.id === columnId);
}

// Linked item ids of a Monday "board relation" column. Newer API versions
// expose them as `linked_item_ids`; older ones store them as JSON in
// `value`, e.g. {"linkedPulseIds":[{"linkedPulseId":123}]}. Support both.
function extractLinkedIds(column: RawColumnValue | undefined): string[] {
  if (!column) return [];
  if (column.linked_item_ids && column.linked_item_ids.length > 0) {
    return column.linked_item_ids.map(String);
  }
  if (!column.value) return [];
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
            column_values(ids: ["${COMPANY_NAME_COLUMN}", "${CONTACT_LINK_COLUMN}"]) {
              id
              text
              value
              ... on BoardRelationValue {
                linked_item_ids
              }
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

const EMAIL_RE = /[A-Z0-9._%+'-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;

// Batch-fetches name + "E-mail" column for a set of Contacts-board item
// ids, regardless of which board the company items live on.
async function fetchContacts(contactIds: string[]): Promise<Map<string, MondayContact>> {
  const contactMap = new Map<string, MondayContact>();
  if (contactIds.length === 0) return contactMap;

  for (const batch of chunk(contactIds, 90)) {
    const query = `
      query ($ids: [ID!]) {
        items(ids: $ids) {
          id
          name
          column_values(ids: ["${CONTACT_EMAIL_COLUMN}"]) {
            text
            ... on EmailValue {
              email
            }
          }
        }
      }
    `;
    const data = await mondayRequest<{
      items: { id: string; name: string | null; column_values: { text: string | null; email?: string | null }[] }[];
    }>(query, { ids: batch });

    for (const item of data.items ?? []) {
      const cv = item.column_values?.[0];
      const raw = cv?.email || cv?.text || '';
      const match = raw.match(EMAIL_RE);
      if (!match) continue;
      contactMap.set(item.id, {
        email: match[0].toLowerCase(),
        name: item.name?.trim() || null,
      });
    }
  }

  return contactMap;
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

  const contactsById = await fetchContacts(Array.from(allContactIds));

  return active.map((company) => {
    // Prefer the "company name" text column, but many items leave it blank
    // and only have the name in the item's own title — fall back to that.
    const name = getColumn(company, COMPANY_NAME_COLUMN)?.text?.trim() || company.name?.trim() || null;

    const contacts: MondayContact[] = [];
    const seen = new Set<string>();
    for (const id of linkedIdsByCompany.get(company.id) ?? []) {
      const contact = contactsById.get(id);
      if (!contact || seen.has(contact.email)) continue;
      seen.add(contact.email);
      contacts.push(contact);
    }

    return {
      monday_item_id: company.id,
      company_name: name,
      contacts,
      group_title: company.group?.title ?? '',
    };
  });
}
