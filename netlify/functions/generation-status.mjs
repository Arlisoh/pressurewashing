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

export default async function handler(req) {
  const unauthorized = requireAdmin(req);
  if (unauthorized) return unauthorized;

  const url = new URL(req.url);
  const jobId = url.searchParams.get('job');
  const store = getStore({ name: 'pressurewash-jobs', consistency: 'strong' });
  const key = jobId ? `jobs/${jobId}.json` : 'latest.json';
  const status = await store.get(key, { type: 'json' });

  if (!status) {
    return Response.json({
      ok: false,
      message: jobId ? 'No status found for that job yet.' : 'No generation status has been saved yet.'
    }, { status: 404 });
  }

  return Response.json({ ok: true, ...status });
}
