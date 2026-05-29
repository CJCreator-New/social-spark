import React, { useEffect, useState } from 'react';
import { getTrends, TrendItem } from '../../lib/trendsApi';

export default function TrendsAdmin() {
  const [items, setItems] = useState<TrendItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const res = await getTrends({ page: 1, limit: 50 });
      setItems(res.data);
    } catch (err) {
      console.error(err);
    } finally { setLoading(false); }
  }

  async function del(id: string) {
    if (!confirm('Delete this trend?')) return;
    try {
      await fetch('/.netlify/functions/trends_admin/delete', { method: 'POST', headers: { 'Content-Type':'application/json', 'x-service-key': '' }, body: JSON.stringify({ id }) });
      load();
    } catch (err) { console.error(err); }
  }

  return (
    <div className="p-4">
      <h2 className="text-xl font-semibold">Trends Admin</h2>
      {loading ? <p>Loading...</p> : (
        <ul>
          {items.map(it => (
            <li key={it.id} className="border p-2 my-2">
              <div className="font-bold">{it.title}</div>
              <div className="text-sm text-muted">{it.platform} · score: {it.score}</div>
              <button onClick={() => del(it.id)} className="mt-2 bg-red-600 text-white px-2 py-1 rounded">Delete</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
