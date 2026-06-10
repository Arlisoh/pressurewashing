import { getIndex, saveIndex, getPost, postsStore, imagesStore } from '../../src/lib/storage.mjs';

function requireAdmin(req) {
  const secret = process.env.ADMIN_GENERATE_SECRET;
  if (!secret) {
    return Response.json({ error: 'ADMIN_GENERATE_SECRET is not set in Netlify.' }, { status: 500 });
  }

  const url = new URL(req.url);
  const provided = req.headers.get('x-admin-secret') || url.searchParams.get('secret');

  if (provided !== secret) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return null;
}

function json(data, status = 200) {
  return Response.json(data, {
    status,
    headers: {
      'cache-control': 'no-store, no-cache, must-revalidate, max-age=0'
    }
  });
}

async function deleteOnePost(slug) {
  const index = await getIndex();
  const fullPost = await getPost(slug);
  const summary = index.find((item) => item.slug === slug);
  const imageKey = fullPost?.imageKey || summary?.imageKey || null;

  await postsStore().delete(`posts/${slug}.json`);

  if (imageKey) {
    try {
      await imagesStore().delete(imageKey);
    } catch (error) {
      console.error(`Could not delete image ${imageKey}`, error);
    }
  }

  const newIndex = index.filter((item) => item.slug !== slug);
  await saveIndex(newIndex);

  return {
    deletedSlug: slug,
    fullPostFound: Boolean(fullPost),
    indexEntryFound: Boolean(summary),
    deletedImage: imageKey,
    remainingPosts: newIndex.length
  };
}

export default async function handler(req) {
  const unauthorized = requireAdmin(req);
  if (unauthorized) return unauthorized;

  const url = new URL(req.url);
  const slug = url.searchParams.get('slug');
  const confirm = url.searchParams.get('confirm');
  const deleteAll = url.searchParams.get('all') === 'true';

  // Safety check so a bot/crawler cannot delete content just by discovering a URL.
  if (deleteAll && confirm !== 'DELETE_ALL') {
    return json({
      ok: false,
      error: 'To delete all posts, add confirm=DELETE_ALL.'
    }, 400);
  }

  if (!deleteAll && confirm !== 'DELETE') {
    return json({
      ok: false,
      error: 'To delete one post, add confirm=DELETE.'
    }, 400);
  }

  if (deleteAll) {
    const index = await getIndex();
    const results = [];

    for (const item of index) {
      if (item?.slug) {
        results.push(await deleteOnePost(item.slug));
      }
    }

    await saveIndex([]);

    return json({
      ok: true,
      mode: 'delete_all',
      deletedCount: results.length,
      results,
      message: 'All indexed posts and their associated images were deleted.'
    });
  }

  if (!slug) {
    return json({
      ok: false,
      error: 'Missing slug. Add ?slug=your-post-slug&confirm=DELETE.'
    }, 400);
  }

  const result = await deleteOnePost(slug);

  return json({
    ok: true,
    mode: 'delete_one',
    ...result,
    message: 'Post deletion complete. You can now run admin-generate again.'
  });
}
