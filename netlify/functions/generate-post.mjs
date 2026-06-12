import { getSiteUrl } from '../../src/lib/config.mjs';
import { recordTrigger } from '../../src/lib/health.mjs';

// Netlify scheduled function (hourly). It only fires the background worker.
// Unlike the old version, it checks the worker invocation response and records
// a heartbeat, so a silently failing schedule is visible at /health.
export default async function handler() {
  const secret = process.env.ADMIN_GENERATE_SECRET || '';
  const jobId = `netlify-cron-${Date.now().toString(36)}`;
  const workerUrl = `${getSiteUrl()}/.netlify/functions/generate-worker?job=${encodeURIComponent(jobId)}&force=false&source=netlify-cron`;

  try {
    const res = await fetch(workerUrl, {
      method: 'POST',
      headers: { 'x-admin-secret': secret }
    });
    const ok = res.status === 202 || res.ok;
    await recordTrigger('netlify-cron', { jobId, workerStatus: res.status, ok });
    if (!ok) {
      console.error(`generate-worker invocation returned HTTP ${res.status}`);
      return Response.json({ ok: false, jobId, workerStatus: res.status }, { status: 500 });
    }
    return Response.json({ ok: true, queued: true, jobId, workerStatus: res.status }, { status: 202 });
  } catch (error) {
    console.error(error);
    await recordTrigger('netlify-cron', { jobId, ok: false, error: error.message });
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }
}
