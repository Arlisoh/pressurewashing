import { pickTarget } from './locations.mjs';
import { generateArticleWithClaude } from './claude.mjs';
import { generateAndDownloadImage } from './images.mjs';
import { getBusiness, getSiteUrl } from './config.mjs';
import { getIndex, getPost, saveImage, saveIndex, savePost, deleteImage } from './storage.mjs';
import { recordImageError } from './health.mjs';

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
    imageModel: post.imageModel || null,
    imagePending: post.imagePending === true,
    tags: post.tags || []
  };
}

function upsertIndex(index, post) {
  return [buildSummary(post), ...index.filter((item) => item.slug !== post.slug)];
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
    contentType: 'image/svg+xml'
  };
}

export function needsRealImage(postOrSummary) {
  if (!postOrSummary) return false;
  if (postOrSummary.imagePending === true) return true;
  if (postOrSummary.imageModel === 'fallback-svg') return true;
  if (String(postOrSummary.imageKey || '').endsWith('.svg')) return true;
  return false;
}

function defaultImagePrompt(post) {
  return `Professional realistic photo of pressure washing a clean concrete driveway in ${post.neighborhood || ''}, ${post.city || 'Southwestern Ohio'}, Ohio, bright natural light, no text.`;
}

// Generate the real GPT Image 2 image for a post and swap it in. On failure,
// the post keeps its placeholder, the exact fal error is stored on the post
// and in the image-error log, and a later run retries automatically.
async function attachRealImage(post, index) {
  try {
    const prompt = post.imagePrompt || defaultImagePrompt(post);
    const image = await generateAndDownloadImage(prompt);
    const saved = await saveImage(post.slug, image.arrayBuffer, image.contentType);
    const oldKey = post.imageKey;
    const updated = {
      ...post,
      imageKey: saved.key,
      imageContentType: saved.contentType,
      imageProviderUrl: image.providerUrl,
      imageModel: image.model,
      imagePending: false,
      imageWarning: null,
      updatedAt: new Date().toISOString()
    };
    await savePost(updated);
    const newIndex = await saveIndex(upsertIndex(index, updated));
    if (oldKey && oldKey !== saved.key) {
      await deleteImage(oldKey);
    }
    return { ok: true, post: updated, index: newIndex };
  } catch (error) {
    console.error(`Image generation failed for ${post.slug}.`, error);
    await recordImageError(post.slug, error.message);
    const updated = {
      ...post,
      imagePending: true,
      imageWarning: String(error.message || '').slice(0, 700),
      updatedAt: new Date().toISOString()
    };
    await savePost(updated);
    const newIndex = await saveIndex(upsertIndex(index, updated));
    return { ok: false, post: updated, index: newIndex, error: updated.imageWarning };
  }
}

export async function generatePost({ force = false } = {}) {
  let index = await getIndex();
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

  // Article-first publishing: save the post with a placeholder image
  // immediately, so a crash or timeout during image generation can never lose
  // the article. The real image is attached right after, or by a later run.
  const now = new Date().toISOString();
  const placeholder = buildFallbackImage({ ...article, slug });
  const placeholderSaved = await saveImage(slug, placeholder.arrayBuffer, placeholder.contentType);

  let post = {
    ...article,
    slug,
    publishedAt: now,
    updatedAt: now,
    imageKey: placeholderSaved.key,
    imageContentType: placeholderSaved.contentType,
    imageProviderUrl: null,
    imageModel: 'fallback-svg',
    imagePending: true,
    imageWarning: null,
    generator: {
      claudeModel: process.env.CLAUDE_MODEL || 'claude-sonnet-4-6',
      imageModel: process.env.FAL_IMAGE_MODEL || 'openai/gpt-image-2'
    }
  };
  await savePost(post);
  index = await saveIndex(upsertIndex(index, post));

  const imageResult = await attachRealImage(post, index);
  return {
    skipped: false,
    post: imageResult.post,
    imageOk: imageResult.ok,
    imageError: imageResult.ok ? null : imageResult.error,
    indexCount: imageResult.index.length
  };
}

// Find recent posts that are still showing the SVG placeholder and try to
// generate their real image. Runs every cycle, so once the fal account/key is
// healthy the whole backlog fills itself in, one image per run by default.
export async function healMissingImages(limit = 1) {
  const index = await getIndex();
  const candidates = index.filter(needsRealImage).slice(0, 25);
  const healed = [];
  const failures = [];

  for (const summary of candidates) {
    if (healed.length >= limit) break;
    if (failures.length >= 1) break; // if fal is down, do not hammer it
    const post = await getPost(summary.slug);
    if (!post || !needsRealImage(post)) continue;
    const result = await attachRealImage(post, index);
    if (result.ok) {
      healed.push(post.slug);
    } else {
      failures.push({ slug: post.slug, error: result.error });
    }
  }

  return { healed, failures, remainingWithoutRealImage: Math.max(candidates.length - healed.length, 0) };
}
