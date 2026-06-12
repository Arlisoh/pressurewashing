import { requireAdmin } from '../../src/lib/auth.mjs';
import { readHealthSnapshot } from '../../src/lib/health.mjs';
import { getIndex } from '../../src/lib/storage.mjs';
import { needsRealImage } from '../../src/lib/generator.mjs';

// One page that answers: is the schedule firing, did the last run work, and
// which posts still need a real image.
// URL: /.netlify/functions/health?secret=YOUR_ADMIN_SECRET
export default async function handler(req) {
  const unauthorized = requireAdmin(req);
  if (unauthorized) return unauthorized;

  try {
    const [snapshot, index] = await Promise.all([readHealthSnapshot(), getIndex()]);
    const missing = index.filter(needsRealImage);

    return Response.json({
      ok: true,
      now: new Date().toISOString(),
      posts: {
        total: index.length,
        latestPublishedAt: index[0]?.publishedAt || null,
        latestSlug: index[0]?.slug || null,
        stillOnPlaceholderImage: missing.length,
        placeholderSlugs: missing.slice(0, 10).map((post) => post.slug)
      },
      triggers: snapshot.triggers,
      lastWorkerRun: snapshot.worker,
      lastJobStatus: snapshot.latestJob,
      lastImageError: snapshot.imageError,
      howToRead: {
        triggers: 'Each entry shows the last time that source fired. netlify-cron and github-cron should both update roughly hourly. If one goes stale, the other keeps the site publishing.',
        lastImageError: 'The exact error fal returned the last time an image failed. A 401/403 here means the FAL_KEY or fal billing/balance needs fixing in the fal dashboard.',
        stillOnPlaceholderImage: 'Posts showing the gradient SVG. Each hourly run regenerates one of these automatically once fal is healthy.'
      }
    });
  } catch (error) {
    console.error(error);
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }
}
