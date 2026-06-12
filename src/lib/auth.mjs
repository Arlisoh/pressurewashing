export function requireAdmin(req, { json = true } = {}) {
  const secret = process.env.ADMIN_GENERATE_SECRET;
  if (!secret) return null;
  const url = new URL(req.url);
  const provided = req.headers.get('x-admin-secret') || url.searchParams.get('secret');
  if (provided !== secret) {
    return json
      ? Response.json({ error: 'Unauthorized' }, { status: 401 })
      : new Response('Unauthorized', { status: 401 });
  }
  return null;
}
