import { getSiteUrl } from '../../src/lib/config.mjs';

export default async function handler() {
  const secret = process.env.ADMIN_GENERATE_SECRET || '';
  const jobId = `scheduled-${Date.now().toString(36)}`;
  const workerUrl = `${getSiteUrl()}/.netlify/functions/generate-worker?secret=${encodeURIComponent(secret)}&job=${encodeURIComponent(jobId)}&force=false`;

  try {
    await fetch(workerUrl, { method: 'POST' });
    return Response.json({ ok: true, queued: true, jobId, message: 'Scheduled generation queued in background.' }, { status: 202 });
  } catch (error) {
    console.error(error);
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }
}
