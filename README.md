# PressureWash AI Netlify Site

A Netlify-hosted pressure washing content site that creates one new local SEO article and image every hour.

## What it does

- Runs a Netlify Scheduled Function every hour.
- Uses Claude to generate a structured, useful article for a Southwestern Ohio city or neighborhood.
- Uses fal.ai with `openai/gpt-image-2` to generate a matching image.
- Stores posts and images in Netlify Blobs.
- Renders the home page and article pages as server-side HTML for SEO.
- Publishes `/sitemap.xml`, `/rss.xml`, `/api/posts`, and article pages at `/pressure-washing/:slug`.

## Required environment variables

Add these in Netlify under **Site configuration → Environment variables** and make sure they are available to **Functions**.

```bash
ANTHROPIC_API_KEY=your_anthropic_key
FAL_KEY=your_fal_key
SITE_URL=https://your-domain.com
BUSINESS_NAME=Clean Home Services
BUSINESS_DOMAIN=cleanhome.services
BUSINESS_EMAIL=you@example.com
BUSINESS_PHONE=513-000-0000
ADMIN_GENERATE_SECRET=make-a-long-random-secret
```

Optional:

```bash
CLAUDE_MODEL=claude-sonnet-4-6
FAL_IMAGE_MODEL=openai/gpt-image-2
MIN_MINUTES_BETWEEN_POSTS=55
MAX_INDEX_POSTS=500
BUSINESS_SERVICES=driveway pressure washing, concrete cleaning, patio cleaning, pool deck cleaning, house soft washing, siding cleaning, fence cleaning, deck cleaning, and commercial exterior cleaning
```

## Deploy to Netlify

1. Upload this folder to a GitHub repo.
2. In Netlify, choose **Add new site → Import an existing project**.
3. Select the repo.
4. Build command: `npm run build`
5. Publish directory: `public`
6. Add the environment variables above.
7. Deploy.

## Create the first post manually

Scheduled functions run on the published schedule, but you can create the first post immediately by visiting:

```text
https://your-domain.com/.netlify/functions/admin-generate?secret=YOUR_ADMIN_GENERATE_SECRET
```

After that, the hourly function will keep adding articles.

## SEO quality note

This build is intentionally designed to generate useful, local, practical articles rather than thin doorway pages. Still, you should review output regularly, add original photos when possible, and avoid publishing hundreds of near-duplicate city pages that do not help real homeowners.

## Key files

```text
netlify/functions/generate-post.mjs   Hourly scheduled generator
netlify/functions/admin-generate.mjs  Manual generator endpoint
netlify/functions/home.mjs            Server-rendered home page
netlify/functions/post.mjs            Server-rendered article page
netlify/functions/image.mjs           Serves stored generated images
src/lib/locations.mjs                 Southwestern Ohio city/neighborhood targets
src/lib/claude.mjs                    Claude article generation prompt
src/lib/images.mjs                    fal.ai GPT Image 2 generation
src/lib/render.mjs                    HTML rendering and schema markup
```
