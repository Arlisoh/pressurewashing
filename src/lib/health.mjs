import { getStore } from '@netlify/blobs';

function jobsStore() {
  return getStore({ name: 'pressurewash-jobs', consistency: 'strong' });
}

// ---------- Heartbeats ----------

export async function recordTrigger(source, info = {}) {
  try {
    const store = jobsStore();
    await store.setJSON(`heartbeat/trigger-${source}.json`, {
      source,
      at: new Date().toISOString(),
      ...info
    });
  } catch (error) {
    console.error('Could not record trigger heartbeat', error);
  }
}

export async function recordWorkerRun(info = {}) {
  try {
    const store = jobsStore();
    await store.setJSON('heartbeat/worker.json', {
      at: new Date().toISOString(),
      ...info
    });
  } catch (error) {
    console.error('Could not record worker heartbeat', error);
  }
}

export async function recordImageError(context, message) {
  try {
    const store = jobsStore();
    await store.setJSON('image-error/latest.json', {
      at: new Date().toISOString(),
      context,
      error: String(message || '').slice(0, 800)
    });
  } catch (error) {
    console.error('Could not record image error', error);
  }
}

async function readJsonSafe(store, key) {
  try {
    return await store.get(key, { type: 'json' });
  } catch (_) {
    return null;
  }
}

export async function readHealthSnapshot() {
  const store = jobsStore();
  const [netlifyCron, githubCron, manual, worker, latestJob, imageError] = await Promise.all([
    readJsonSafe(store, 'heartbeat/trigger-netlify-cron.json'),
    readJsonSafe(store, 'heartbeat/trigger-github-cron.json'),
    readJsonSafe(store, 'heartbeat/trigger-manual.json'),
    readJsonSafe(store, 'heartbeat/worker.json'),
    readJsonSafe(store, 'latest.json'),
    readJsonSafe(store, 'image-error/latest.json')
  ]);

  return {
    triggers: {
      'netlify-cron': netlifyCron,
      'github-cron': githubCron,
      manual
    },
    worker,
    latestJob,
    imageError
  };
}

// ---------- Generation lock ----------
// Prevents the Netlify cron and the GitHub Actions cron from generating at the
// same moment. Not a perfect mutex, but the two schedules are minutes apart and
// the MIN_MINUTES_BETWEEN_POSTS gate backstops it.

export async function acquireLock(maxAgeMinutes = 12) {
  const store = jobsStore();
  const existing = await readJsonSafe(store, 'lock.json');
  if (existing?.at) {
    const ageMs = Date.now() - new Date(existing.at).getTime();
    if (ageMs < maxAgeMinutes * 60 * 1000) {
      return { acquired: false, holder: existing };
    }
  }
  const token = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  await store.setJSON('lock.json', { at: new Date().toISOString(), token });
  return { acquired: true, token };
}

export async function releaseLock(token) {
  if (!token) return;
  try {
    const store = jobsStore();
    const existing = await readJsonSafe(store, 'lock.json');
    if (existing?.token === token) {
      await store.delete('lock.json');
    }
  } catch (error) {
    console.error('Could not release lock', error);
  }
}
