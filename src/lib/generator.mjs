import { pickTarget } from './locations.mjs';
import { generateArticleWithClaude } from './claude.mjs';
import { generateAndDownloadImage } from './images.mjs';
import { getBusiness } from './config.mjs';
import { getIndex, saveImage, saveIndex, savePost } from './storage.mjs';
import { getSiteUrl } from './config.mjs';

function buildSummary(post) {
  return {
    title: post.title,
    slug: post.slug,
    url: `${getSiteUrl()}/pressure-washing/${post.slug}`,
    excerpt: post.excerpt,
    metaTitle: post.metaTitle,
    metaDescription: post.metaDescription,
    publishedAt: post.publishedAt,
    updatedAt: post.updatedAt,
    city: post.city,
    county: post.county,
    neighborhood: post.neighborhood,
    topic: post.topic,
    imageKey: post.imageKey,
    imageContentType: post.imageContentType,
    tags: post.tags || []
  };
}


function escapeXml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildFallbackImage(article) {
  const business = getBusiness();
  const city = article.city || business.city || 'Southwestern Ohio';
  const title = article.title || 'Pressure Washing Guide';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900" viewBox="0 0 1600 900">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#0f766e"/>
      <stop offset="1" stop-color="#0f172a"/>
    </linearGradient>
  </defs>
  <rect width="1600" height="900" fill="url(#g)"/>
  <circle cx="1270" cy="160" r="280" fill="rgba(255,255,255,.09)"/>
  <circle cx="180" cy="790" r="260" fill="rgba(255,255,255,.08)"/>
  <text x="90" y="170" fill="#ccfbf1" font-family="Arial, Helvetica, sans-serif" font-size="38" font-weight="700" letter-spacing="3">${escapeXml(business.name)}</text>
  <text x="90" y="390" fill="#ffffff" font-family="Georgia, serif" font-size="76" font-weight="700">${escapeXml(city)}</text>
  <foreignObject x="90" y="430" width="1180" height="240">
    <div xmlns="http://www.w3.org/1999/xhtml" style="font-family:Arial,Helvetica,sans-serif;color:white;font-size:54px;font-weight:700;line-height:1.12">${escapeXml(title)}</div>
  </foreignObject>
  <text x="90" y="790" fill="#e0f2fe" font-family="Arial, Helvetica, sans-serif" font-size="34">Driveways • Patios • Pool Decks • House Washing</text>
</svg>`;
  return {
    arrayBuffer: new TextEncoder().encode(svg).buffer,
    contentType: 'image/svg+xml',
    providerUrl: null,
    model: 'fallback-svg'
  };
}

export async function generatePost({ force = false } = {}) {
  const index = await getIndex();
  const latest = index[0];
  const minMinutes = Number(process.env.MIN_MINUTES_BETWEEN_POSTS || 55);
  if (!force && latest) {
    const ageMs = Date.now() - new Date(latest.publishedAt).getTime();
    if (ageMs < minMinutes * 60 * 1000) {
      return { skipped: true, reason: `Latest post is newer than ${minMinutes} minutes.`, latest };
    }
  }

  const target = pickTarget(index);
  const article = await generateArticleWithClaude(target, index);
  let slug = article.slug;
  if (index.some((post) => post.slug === slug)) {
    slug = `${slug}-${Date.now().toString(36).slice(-5)}`;
  }

  let image;
  let imageWarning = null;
  try {
    image = await generateAndDownloadImage(article.imagePrompt);
  } catch (error) {
    console.error('Image generation failed. Saving a fallback SVG image so the article can still publish.', error);
    imageWarning = error.message;
    image = buildFallbackImage(article);
  }

  const imageSaved = await saveImage(slug, image.arrayBuffer, image.contentType);

  const now = new Date().toISOString();
  const post = {
    ...article,
    slug,
    publishedAt: now,
    updatedAt: now,
    imageKey: imageSaved.key,
    imageContentType: imageSaved.contentType,
    imageProviderUrl: image.providerUrl,
    imageModel: image.model,
    imageWarning,
    generator: {
      claudeModel: process.env.CLAUDE_MODEL || 'claude-sonnet-4-6',
      imageModel: image.model
    }
  };

  await savePost(post);
  const newIndex = await saveIndex([buildSummary(post), ...index.filter((item) => item.slug !== post.slug)]);
  return { skipped: false, post, indexCount: newIndex.length };
}
