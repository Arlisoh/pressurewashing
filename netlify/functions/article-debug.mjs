import { getIndex, getPost } from '../../src/lib/storage.mjs';
import { getSiteUrl } from '../../src/lib/config.mjs';

function requireAdmin(req) {
  const secret = process.env.ADMIN_GENERATE_SECRET;
  if (!secret) return null;
  const url = new URL(req.url);
  const provided = url.searchParams.get('secret');
  if (provided !== secret) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  return null;
}

export default async function handler(req) {
  const unauthorized = requireAdmin(req);
  if (unauthorized) return unauthorized;

  const url = new URL(req.url);
  const slug = url.searchParams.get('slug');
  const index = await getIndex();
  const latest = index[0] || null;
  const targetSlug = slug || latest?.slug || '';
  const post = targetSlug ? await getPost(targetSlug) : null;
  const base = getSiteUrl();

  return Response.json({
    ok: true,
    indexCount: index.length,
    latestSummary: latest ? { title: latest.title, slug: latest.slug, url: `${base}/pressure-washing/${latest.slug}`, directFunctionUrl: `${base}/.netlify/functions/post?slug=${encodeURIComponent(latest.slug)}` } : null,
    testedSlug: targetSlug,
    fullPostFound: Boolean(post),
    fullPostPreview: post ? { title: post.title, introPresent: Boolean(post.intro), sectionCount: post.sections?.length || 0, faqCount: post.faq?.length || 0, imageKey: post.imageKey } : null
  });
}
