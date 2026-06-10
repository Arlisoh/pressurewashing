import { getIndex } from '../../src/lib/storage.mjs';

export default async function handler() {
  const posts = await getIndex();
  return Response.json({ posts }, {
    headers: { 'cache-control': 'public, max-age=60, stale-while-revalidate=600' }
  });
}
