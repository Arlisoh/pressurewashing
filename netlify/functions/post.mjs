import { getIndex, getPost } from '../../src/lib/storage.mjs';
import { renderNotFound, renderPost } from '../../src/lib/render.mjs';

function extractSlugFromRequest(req) {
  const url = new URL(req.url);

  // Normal path used by the direct function URL:
  // /.netlify/functions/post?slug=some-article
  const fromQuery = url.searchParams.get('slug');
  if (fromQuery) return decodeURIComponent(fromQuery).replace(/^\/+|\/+$/g, '');

  // Netlify rewrites usually keep the original browser URL in one of these headers.
  const possibleOriginalUrls = [
    req.headers.get('x-nf-original-url'),
    req.headers.get('x-original-url'),
    req.headers.get('referer')
  ].filter(Boolean);

  for (const value of possibleOriginalUrls) {
    try {
      const original = new URL(value, url.origin);
      const match = original.pathname.match(/\/(?:pressure-washing|blog)\/([^/?#]+)/);
      if (match?.[1]) return decodeURIComponent(match[1]).replace(/^\/+|\/+$/g, '');
    } catch (_) {
      // keep trying fallbacks
    }
  }

  // Fallback for function URLs with a path suffix, if Netlify forwards it.
  const pathMatch = url.pathname.match(/\/(?:pressure-washing|blog|post)\/([^/?#]+)/);
  if (pathMatch?.[1]) return decodeURIComponent(pathMatch[1]).replace(/^\/+|\/+$/g, '');

  return '';
}

export default async function handler(req) {
  const slug = extractSlugFromRequest(req);
  const [post, index] = await Promise.all([getPost(slug), getIndex()]);
  if (!post) {
    return new Response(renderNotFound(slug), {
      status: 404,
      headers: { 'content-type': 'text/html; charset=utf-8' }
    });
  }
  return new Response(renderPost(post, index), {
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'public, max-age=60, stale-while-revalidate=3600'
    }
  });
}
