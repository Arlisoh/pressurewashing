import { getIndex, getPost } from '../../src/lib/storage.mjs';
import { renderNotFound, renderPost } from '../../src/lib/render.mjs';

export default async function handler(req) {
  const url = new URL(req.url);
  const slug = url.searchParams.get('slug');
  const [post, index] = await Promise.all([getPost(slug), getIndex()]);
  if (!post) {
    return new Response(renderNotFound(), {
      status: 404,
      headers: { 'content-type': 'text/html; charset=utf-8' }
    });
  }
  return new Response(renderPost(post, index), {
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'public, max-age=300, stale-while-revalidate=3600'
    }
  });
}
