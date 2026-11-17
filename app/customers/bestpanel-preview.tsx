import { useState } from 'react';
import { supabase } from '../../lib/supabase';

type PreviewRow = {
  id: number;
  username: string;
  customerName: string | null;
  currentExpirationDate: string | null;
  expirationDate: string | null;
  status: string;
};

export default function BestPanelPreview() {
  const [rows, setRows] = useState<PreviewRow[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function preview() {
    setLoading(true);
    setError('');
    setRows(null);
    try {
      const client = supabase();
      const session = (await client?.auth.getSession())?.data.session;
      if (!session) throw new Error('Sign in again to preview BestPanel.');

      const response = await fetch('/api/bestpanel/preview', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not load the BestPanel preview.');
      setRows(result.rows);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Could not load the BestPanel preview.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="card" aria-labelledby="bestpanel-heading" style={{ overflowX: 'auto' }}>
      <h2 id="bestpanel-heading">BestPanel</h2>
      <button type="button" className="btn btn2" onClick={preview} disabled={loading}>
        {loading ? 'Loading BestPanel…' : 'Preview BestPanel Sync'}
      </button>
      {error && <p role="alert">{error}</p>}
      {rows && (
        <>
          <p role="status">{rows.length} subscriptions. Dates are shown in New York time.</p>
          {rows.length > 0 && (
            <table>
              <thead>
                <tr><th>BestPanel username</th><th>914 IPTV customer</th><th>Current expiry</th><th>BestPanel expiry</th><th>Result</th></tr>
              </thead>
              <tbody>
                {rows.map(row => (
                  <tr key={row.id}>
                    <td>{row.username}</td>
                    <td>{row.customerName ?? '—'}</td>
                    <td>{row.currentExpirationDate ?? '—'}</td>
                    <td>{row.expirationDate ?? '—'}</td>
                    <td>{row.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}
    </section>
  );
}
