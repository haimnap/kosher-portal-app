// Monday.com integration
//
// This syncs certification data between your existing Monday.com board
// and the portal's Supabase database, in both directions:
//   - PULL (sync): read items from the Monday board into `certifications`
//   - PUSH (webhook): Monday notifies the portal instantly when an item changes
//
// SETUP REQUIRED — see README.md "Connecting Monday.com" for the full
// walkthrough. In short, you need to:
//   1. Get an API token from Monday.com (Avatar > Admin > API)
//   2. Find your board ID (open the board, it's in the URL)
//   3. Map your board's columns to certification fields below via env vars
//   4. Register a webhook pointing at /api/monday/webhook

const MONDAY_API_URL = 'https://api.monday.com/v2';

interface MondayColumnValue {
  id: string;
  text: string | null;
  value: string | null;
}

interface MondayItem {
  id: string;
  name: string; // item name = product name by default
  column_values: MondayColumnValue[];
}

// Column IDs on your Monday board, configured via environment variables.
// Find a column's ID by opening the board > clicking the column header's
// "..." menu > "Column settings" — the ID is shown there, or use
// Monday's API playground with a boards { columns { id title } } query.
export const MONDAY_COLUMNS = {
  clientEmail: process.env.MONDAY_COL_CLIENT_EMAIL || '',
  category: process.env.MONDAY_COL_CATEGORY || '',
  certNumber: process.env.MONDAY_COL_CERT_NUMBER || '',
  dateIssued: process.env.MONDAY_COL_DATE_ISSUED || '',
  expirationDate: process.env.MONDAY_COL_EXPIRATION || '',
  notes: process.env.MONDAY_COL_NOTES || '',
};

export async function mondayRequest<T = unknown>(query: string, variables?: Record<string, unknown>): Promise<T> {
  const token = process.env.MONDAY_API_TOKEN;
  if (!token) throw new Error('MONDAY_API_TOKEN is not set');

  const res = await fetch(MONDAY_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: token,
    },
    body: JSON.stringify({ query, variables }),
  });

  const json = await res.json();
  if (json.errors) {
    throw new Error(`Monday API error: ${JSON.stringify(json.errors)}`);
  }
  return json.data as T;
}

export async function fetchBoardItems(boardId: string): Promise<MondayItem[]> {
  const query = `
    query ($boardId: [ID!]) {
      boards(ids: $boardId) {
        items_page(limit: 100) {
          items {
            id
            name
            column_values {
              id
              text
              value
            }
          }
        }
      }
    }
  `;

  const data = await mondayRequest<{
    boards: { items_page: { items: MondayItem[] } }[];
  }>(query, { boardId: [boardId] });

  return data.boards?.[0]?.items_page?.items ?? [];
}

function getColumnText(item: MondayItem, columnId: string): string | null {
  if (!columnId) return null;
  return item.column_values.find((cv) => cv.id === columnId)?.text || null;
}

// Converts a Monday item into fields ready to upsert into `certifications`.
// Returns null (and logs why) if required fields are missing — e.g. the
// column mapping isn't configured yet, or this item hasn't been filled
// in completely by the mashguiach.
export function mapMondayItem(item: MondayItem): {
  monday_item_id: string;
  product_name: string;
  client_email: string | null;
  product_category: string | null;
  certification_number: string | null;
  date_issued: string | null;
  expiration_date: string | null;
  mashguiach_notes: string | null;
} | null {
  const clientEmail = getColumnText(item, MONDAY_COLUMNS.clientEmail);
  const expirationDate = getColumnText(item, MONDAY_COLUMNS.expirationDate);
  const certNumber = getColumnText(item, MONDAY_COLUMNS.certNumber);

  if (!clientEmail || !expirationDate || !certNumber) {
    return null; // not enough info yet to sync this item
  }

  return {
    monday_item_id: item.id,
    product_name: item.name,
    client_email: clientEmail,
    product_category: getColumnText(item, MONDAY_COLUMNS.category),
    certification_number: certNumber,
    date_issued: getColumnText(item, MONDAY_COLUMNS.dateIssued),
    expiration_date: expirationDate,
    mashguiach_notes: getColumnText(item, MONDAY_COLUMNS.notes),
  };
}
