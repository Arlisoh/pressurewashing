import { mkdir, writeFile } from 'node:fs/promises';

await mkdir('public', { recursive: true });
await writeFile('public/robots.txt', `User-agent: *\nAllow: /\nSitemap: ${process.env.SITE_URL || process.env.URL || 'https://example.com'}/sitemap.xml\n`);
console.log('Static shell assets ready. Dynamic pages are rendered by Netlify Functions.');
