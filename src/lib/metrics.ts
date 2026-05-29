import fetch from 'node-fetch';
import { captureException } from './monitoring';

const PUSHGATEWAY = process.env.PUSHGATEWAY_URL || (typeof window !== 'undefined' && (window as any).__ENV__?.PUSHGATEWAY_URL) || undefined;

export async function pushMetrics(name: string, metrics: Record<string, number | string>) {
  try {
    if (PUSHGATEWAY) {
      // simple JSON push for pushgateway-like endpoints
      await fetch(PUSHGATEWAY, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, metrics, ts: new Date().toISOString() }) });
      return true;
    } else {
      console.log('[metrics]', name, metrics);
      return true;
    }
  } catch (err) {
    captureException(err);
    console.error('pushMetrics error', err);
    return false;
  }
}

export function summarizeCounts(obj: Record<string, any>) {
  const flat: Record<string, number> = {};
  for (const k of Object.keys(obj)) {
    const v = obj[k];
    if (typeof v === 'number') flat[k] = v;
    else if (typeof v === 'object' && v !== null) {
      for (const sub of Object.keys(v)) {
        const val = v[sub];
        if (typeof val === 'number') flat[`${k}_${sub}`] = val;
      }
    }
  }
  return flat;
}
