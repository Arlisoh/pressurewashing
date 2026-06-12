import { generatePost, healMissingImages } from '../../src/lib/generator.mjs';
import { getSiteUrl } from '../../src/lib/config.mjs';
import { requireAdmin } from '../../src/lib/auth.mjs';
import { acquireLock, releaseLock, recordTrigger, recordWorkerRun } from '../../src/lib/health.mjs';
import { getStore } from '@netlify/blobs';

export const config = {
  background: true
};

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
  const jobId = url.searchParams.get('job') || `job-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  const force = url.searchParams.get('force') === 'true';
  const source = url.searchParams.get('source') || 'manual';
  const startedAt = Date.now();

  // Record that this trigger source reached the worker end-to-end.
  await recordTrigger(source, { jobId, ok: true, workerStatus: 202 });

  const lock = await acquireLock();
  if (!lock.acquired) {
    await saveStatus(jobId, {
      status: 'skipped',
      source,
      message: 'Another generation run is already in progress. Skipping to avoid duplicates.',
      lockHolder: lock.holder
    });
    return;
  }

  await saveStatus(jobId, {
    status: 'running',
    source,
    message: 'Claude article and fal image generation running in the background.'
  });

  try {
    const result = await generatePost({ force });

    // Every run also tries to backfill one missing image from earlier posts.
    let heal = { healed: [], failures: [], remainingWithoutRealImage: 0 };
    try {
      heal = await healMissingImages(Number(process.env.HEAL_IMAGES_PER_RUN || 1));
    } catch (healError) {
      console.error('Image healing pass failed', healError);
      heal = { healed: [], failures: [{ error: healError.message }], remainingWithoutRealImage: null };
    }

    const summary = {
      status: result.skipped ? 'skipped' : 'complete',
      source,
      message: result.skipped
        ? result.reason
        : (result.imageOk
            ? 'Post and image generated successfully.'
            : 'Post published. Image generation failed and will be retried automatically. See result.imageError for the exact fal error.'),
      result: result.skipped ? { reason: result.reason } : {
        title: result.post?.title,
        slug: result.post?.slug,
        url: result.post?.slug ? `${getSiteUrl()}/pressure-washing/${result.post.slug}` : undefined,
        imageOk: result.imageOk,
        imageError: result.imageError || null,
        indexCount: result.indexCount
      },
      imageHealing: heal,
      durationSeconds: Math.round((Date.now() - startedAt) / 1000)
    };
    await saveStatus(jobId, summary);
    await recordWorkerRun({
      jobId,
      source,
      outcome: summary.status,
      newPostSlug: result.skipped ? null : result.post?.slug,
      imageOk: result.skipped ? null : result.imageOk,
      healedImages: heal.healed,
      remainingWithoutRealImage: heal.remainingWithoutRealImage,
      durationSeconds: summary.durationSeconds
    });
  } catch (error) {
    console.error(error);
    await saveStatus(jobId, {
      status: 'error',
      source,
      message: 'Generation failed. Check this error first.',
      error: error.message,
      stack: process.env.SHOW_STACKS === 'true' ? error.stack : undefined
    });
    await recordWorkerRun({ jobId, source, outcome: 'error', error: error.message });
  } finally {
    await releaseLock(lock.token);
  }
}
