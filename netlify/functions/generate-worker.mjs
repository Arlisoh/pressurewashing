import { generatePost } from '../../src/lib/generator.mjs';
import { getStore } from '@netlify/blobs';
import { getSiteUrl } from '../../src/lib/config.mjs';

export const config = {
  background: true
};

function requireAdmin(req) {
  const secret = process.env.ADMIN_GENERATE_SECRET;
  if (!secret) return null;
  const url = new URL(req.url);
  const provided = req.headers.get('x-admin-secret') || url.searchParams.get('secret');
  if (provided !== secret) {
    return new Response('Unauthorized', { status: 401 });
  }
  return null;
}

async function saveStatus(jobId, status) {
  const store = getStore({ name: 'pressurewash-jobs', consistency: 'strong' });
  const body = {
    jobId,
    ...status,
    updatedAt: new Date().toISOString()
  };
  await store.setJSON(`jobs/${jobId}.json`, body);
  await store.setJSON('latest.json', body);
}

export default async function handler(req) {
  const unauthorized = requireAdmin(req);
  if (unauthorized) return unauthorized;

  const url = new URL(req.url);
  const jobId = url.searchParams.get('job') || `scheduled-${Date.now().toString(36)}`;
  const force = url.searchParams.get('force') === 'true';

  await saveStatus(jobId, {
    status: 'running',
    message: 'Claude and fal generation is running in the background.'
  });

  try {
    const result = await generatePost({ force });
    await saveStatus(jobId, {
      status: result.skipped ? 'skipped' : 'complete',
      message: result.skipped ? result.reason : 'Post generated successfully.',
      result: result.skipped ? result : {
        title: result.post?.title,
        slug: result.post?.slug,
        url: result.post?.slug ? `${getSiteUrl()}/pressure-washing/${result.post.slug}` : undefined,
        imageWarning: result.post?.imageWarning || null,
        indexCount: result.indexCount
      }
    });
  } catch (error) {
    console.error(error);
    await saveStatus(jobId, {
      status: 'error',
      message: 'Generation failed. Check this error first.',
      error: error.message,
      stack: process.env.SHOW_STACKS === 'true' ? error.stack : undefined
    });
  }
}
