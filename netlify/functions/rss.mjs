import { getIndex } from '../../src/lib/storage.mjs';
import { getBusiness, getSiteUrl } from '../../src/lib/config.mjs';
import { escapeHtml } from '../../src/lib/text.mjs';

export default async function handler() {
  const posts = await getIndex();
  const siteUrl = getSiteUrl();
  const business = getBusiness();
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>${escapeHtml(business.name)} Pressure Washing Guides</title>
    <link>${escapeHtml(siteUrl)}</link>
    <description>Local pressure washing and exterior cleaning articles for Southwestern Ohio.</description>
    <lastBuildDate>${new Date(posts[0]?.publishedAt || Date.now()).toUTCString()}</lastBuildDate>
    ${posts.slice(0, 30).map((post) => {
      const url = `${siteUrl}/pressure-washing/${post.slug}`;
      return `<item><title>${escapeHtml(post.title)}</title><link>${escapeHtml(url)}</link><guid>${escapeHtml(url)}</guid><pubDate>${new Date(post.publishedAt).toUTCString()}</pubDate><description>${escapeHtml(post.excerpt || post.metaDescription || '')}</description></item>`;
    }).join('\n    ')}
  </channel>
</rss>`;
  return new Response(xml, {
    headers: {
      'content-type': 'application/rss+xml; charset=utf-8',
      'cache-control': 'public, max-age=300, stale-while-revalidate=3600'
    }
  });
}
