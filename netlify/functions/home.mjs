import { getIndex } from '../../src/lib/storage.mjs';
import { renderHome } from '../../src/lib/render.mjs';

export default async function handler() {
  const posts = await getIndex();
  return new Response(renderHome(posts), {
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'public, max-age=60, stale-while-revalidate=600'
    }
  });
}
