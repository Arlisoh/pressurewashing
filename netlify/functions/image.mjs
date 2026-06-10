import { getImage } from '../../src/lib/storage.mjs';

export default async function handler(req) {
  const url = new URL(req.url);
  const slug = url.searchParams.get('slug');
  const entry = await getImage(slug);
  if (!entry || !entry.data) {
    return new Response('Image not found', { status: 404 });
  }
  const contentType = entry.metadata?.contentType || (slug?.endsWith('.jpg') ? 'image/jpeg' : 'image/png');
  return new Response(entry.data, {
    headers: {
      'content-type': contentType,
      'cache-control': 'public, max-age=31536000, immutable'
    }
  });
}
