import { pickTarget } from './locations.mjs';
import { generateArticleWithClaude } from './claude.mjs';
import { generateAndDownloadImage } from './images.mjs';
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

  const image = await generateAndDownloadImage(article.imagePrompt);
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
    generator: {
      claudeModel: process.env.CLAUDE_MODEL || 'claude-sonnet-4-6',
      imageModel: image.model
    }
  };

  await savePost(post);
  const newIndex = await saveIndex([buildSummary(post), ...index.filter((item) => item.slug !== post.slug)]);
  return { skipped: false, post, indexCount: newIndex.length };
}
