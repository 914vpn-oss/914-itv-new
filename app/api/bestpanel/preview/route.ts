import { NextRequest, NextResponse } from 'next/server';
import { admin } from '../../../../lib/server';

type Line = {
  id: number;
  username: string;
  exp_date: string | null;
  unlimited: boolean;
};

const expiryFormat = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/New_York',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
}

async function listLines(token: string) {
  const lines = new Map<number, Line>();
  const signal = AbortSignal.timeout(15000);
  const perPage = 50;
  for (let page = 1; ; page++) {
    const url = new URL('https://bestpanel.xyz/api/v1/reseller/lines');
    url.search = new URLSearchParams({ page: String(page), per_page: String(perPage), sort: 'id', dir: 'asc' }).toString();
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      cache: 'no-store',
      redirect: 'error',
      signal,
    });
    if (!response.ok) throw new Error('BestPanel request failed');
    const result = await response.json();
    if (!Array.isArray(result.items) || !Number.isSafeInteger(result.total) ||
      result.total < 0 || result.page !== page || result.per_page !== perPage) {
      throw new Error('Invalid BestPanel page');
    }
    for (const line of result.items) {
      if (!line || !Number.isSafeInteger(line.id) || typeof line.username !== 'string' ||
        (line.exp_date !== null && typeof line.exp_date !== 'string')) {
        throw new Error('Invalid BestPanel subscription');
      }
      lines.set(line.id, { id: line.id, username: line.username, exp_date: line.exp_date, unlimited: line.unlimited === true });
    }
    if (page * perPage >= result.total) return [...lines.values()];
    if (result.items.length !== perPage) throw new Error('Incomplete BestPanel page');
  }
}

export async function GET(request: NextRequest) {
  const sessionToken = request.headers.get('authorization')?.match(/^Bearer (\S+)$/i)?.[1];
  if (!sessionToken) return json({ error: 'Sign in to preview BestPanel.' }, 401);

  try {
    const db = admin();
    const { data: { user }, error: authError } = await db.auth.getUser(sessionToken);
    if (authError || !user) return json({ error: 'Sign in again to preview BestPanel.' }, 401);

    const ownerId = process.env.BESTPANEL_OWNER_USER_ID?.trim();
    const panelToken = process.env.BESTPANEL_API_TOKEN?.trim();
    if (!ownerId) return json({ error: 'BestPanel preview needs owner configuration.' }, 503);
    if (user.id !== ownerId) return json({ error: 'BestPanel preview is available to the configured owner.' }, 403);
    if (!panelToken) return json({ error: 'BestPanel preview needs a read-only API token.' }, 503);

    const [lines, customers] = await Promise.all([
      listLines(panelToken),
      db.from('customers').select('id, full_name, email, username, expiration_date')
        .ilike('service', 'BestPanel')
        .order('id'),
    ]);
    if (customers.error) return json({ error: 'Could not load 914 IPTV customers for comparison.' }, 500);

    return json({
      rows: lines.map(line => {
        const matches = customers.data.filter(customer => customer.username?.trim() === line.username);
        const match = matches.length === 1 ? matches[0] : null;
        const expiry = line.exp_date ? new Date(line.exp_date) : null;
        const expirationDate = !line.unlimited && expiry && Number.isFinite(expiry.getTime())
          ? expiryFormat.format(expiry)
          : null;
        const status = matches.length > 1 ? 'Multiple customer matches'
          : !match ? 'Needs customer name and email'
          : !match.email?.trim() ? 'Needs email'
          : !expirationDate ? 'No finite BestPanel expiry'
          : expirationDate === match.expiration_date ? 'Up to date' : 'Expiration changed';

        return {
          id: line.id,
          username: line.username,
          customerName: match?.full_name ?? null,
          currentExpirationDate: match?.expiration_date ?? null,
          expirationDate,
          status,
        };
      }),
    });
  } catch {
    return json({ error: 'Could not load the BestPanel preview. Check the connection and try again.' }, 502);
  }
}
