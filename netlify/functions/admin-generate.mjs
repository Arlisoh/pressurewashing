import { generatePost } from '../../src/lib/generator.mjs';

export default async function handler(req) {
  try {
    const secret = process.env.ADMIN_GENERATE_SECRET;
    if (secret) {
      const url = new URL(req.url);
      const provided = req.headers.get('x-admin-secret') || url.searchParams.get('secret');
      if (provided !== secret) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }
    const result = await generatePost({ force: true });
    return Response.json(result, { status: result.skipped ? 200 : 201 });
  } catch (error) {
    console.error(error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
