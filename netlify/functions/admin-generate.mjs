import { getSiteUrl } from '../../src/lib/config.mjs';
import { getStore } from '@netlify/blobs';

function requireAdmin(req) {
  const secret = process.env.ADMIN_GENERATE_SECRET;
  if (!secret) return null;
  const url = new URL(req.url);
  const provided = req.headers.get('x-admin-secret') || url.searchParams.get('secret');
  if (provided !== secret) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return null;
}

async function saveStatus(jobId, status) {
  const store = getStore({ name: 'pressurewash-jobs', consistency: 'strong' });
  await store.setJSON(`jobs/${jobId}.json`, {
    jobId,
    ...status,
    updatedAt: new Date().toISOString()
  });
}

export default async function handler(req) {
  const unauthorized = requireAdmin(req);
  if (unauthorized) return unauthorized;

  const jobId = `job-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  await saveStatus(jobId, {
    status: 'queued',
    message: 'Generation has been queued in the background. This avoids browser 502 timeouts while Claude and fal run.'
  });

  const siteUrl = getSiteUrl();
  const secret = process.env.ADMIN_GENERATE_SECRET || '';
  const workerUrl = `${siteUrl}/.netlify/functions/generate-worker?secret=${encodeURIComponent(secret)}&job=${encodeURIComponent(jobId)}&force=true&source=manual`;

  try {
    await fetch(workerUrl, { method: 'POST' });
  } catch (error) {
    await saveStatus(jobId, {
      status: 'error',
      message: 'Could not start the background generator.',
      error: error.message
    });
    return Response.json({ ok: false, error: error.message, jobId }, { status: 500 });
  }

  return Response.json({
    ok: true,
    queued: true,
    jobId,
    message: 'Started. Wait 1 to 3 minutes, then check the status URL or refresh the homepage.',
    statusUrl: `${siteUrl}/.netlify/functions/generation-status?secret=${encodeURIComponent(secret)}&job=${encodeURIComponent(jobId)}`,
    latestStatusUrl: `${siteUrl}/.netlify/functions/generation-status?secret=${encodeURIComponent(secret)}`,
    homepage: `${siteUrl}/`
  }, { status: 202 });
}
