import { getStore } from '@netlify/blobs';

export function postsStore() {
  return getStore({ name: 'pressurewash-posts', consistency: 'strong' });
}

export function imagesStore() {
  return getStore({ name: 'pressurewash-images', consistency: 'strong' });
}

export async function getIndex() {
  const store = postsStore();
  const index = await store.get('index.json', { type: 'json' });
  return Array.isArray(index) ? index : [];
}

export async function saveIndex(posts) {
  const store = postsStore();
  const cleanPosts = posts
    .filter(Boolean)
    .sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt))
    .slice(0, Number(process.env.MAX_INDEX_POSTS || 500));
  await store.setJSON('index.json', cleanPosts, {
    metadata: { updatedAt: new Date().toISOString() }
  });
  return cleanPosts;
}

export async function getPost(slug) {
  if (!slug) return null;
  const store = postsStore();
  return await store.get(`posts/${slug}.json`, { type: 'json' });
}

export async function savePost(post) {
  const store = postsStore();
  await store.setJSON(`posts/${post.slug}.json`, post, {
    metadata: {
      title: post.title,
      city: post.city,
      publishedAt: post.publishedAt
    }
  });
}

export async function saveImage(slug, imageArrayBuffer, contentType = 'image/png') {
  const store = imagesStore();
  const extension = contentType.includes('svg')
    ? 'svg'
    : contentType.includes('webp')
      ? 'webp'
      : (contentType.includes('jpeg') || contentType.includes('jpg') ? 'jpg' : 'png');
  const key = `${slug}.${extension}`;
  await store.set(key, imageArrayBuffer, {
    metadata: {
      contentType,
      slug,
      createdAt: new Date().toISOString()
    }
  });
  return { key, contentType };
}

export async function getImage(key) {
  if (!key) return null;
  const store = imagesStore();
  return await store.getWithMetadata(key, { type: 'arrayBuffer' });
}

export async function deleteImage(key) {
  if (!key) return;
  const store = imagesStore();
  try {
    await store.delete(key);
  } catch (error) {
    console.error('Could not delete old image blob', key, error);
  }
}
