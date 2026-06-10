import { getIndex } from '../../src/lib/storage.mjs';
import { getSiteUrl } from '../../src/lib/config.mjs';
import { escapeHtml } from '../../src/lib/text.mjs';

export default async function handler() {
  const siteUrl = getSiteUrl();
  const posts = await getIndex();
  const urls = [
    { loc: `${siteUrl}/`, lastmod: posts[0]?.publishedAt || new Date().toISOString(), priority: '1.0' },
    ...posts.map((post) => ({ loc: `${siteUrl}/pressure-washing/${post.slug}`, lastmod: post.updatedAt || post.publishedAt, priority: '0.8' }))
  ];
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((url) => `  <url><loc>${escapeHtml(url.loc)}</loc><lastmod>${escapeHtml(url.lastmod)}</lastmod><changefreq>daily</changefreq><priority>${url.priority}</priority></url>`).join('\n')}
</urlset>`;
  return new Response(xml, {
    headers: {
      'content-type': 'application/xml; charset=utf-8',
      'cache-control': 'public, max-age=300, stale-while-revalidate=3600'
    }
  });
}
