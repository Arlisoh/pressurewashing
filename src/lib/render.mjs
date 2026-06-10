import { getBusiness, getSiteUrl } from './config.mjs';
import { escapeHtml, formatDate } from './text.mjs';

function absolute(path = '/') {
  const base = getSiteUrl();
  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
}

function nav() {
  const business = getBusiness();
  const phone = business.phone ? `<a class="btn" href="tel:${escapeHtml(business.phone.replace(/[^+0-9]/g, ''))}">Call ${escapeHtml(business.phone)}</a>` : `<a class="btn" href="mailto:${escapeHtml(business.email || `info@${business.domain}`)}">Request a Quote</a>`;
  return `<header class="topbar"><div class="wrap nav"><a class="brand" href="/"><span class="brand-mark" aria-hidden="true"></span><span>${escapeHtml(business.name)}</span></a><nav class="navlinks"><a href="/#latest">Latest</a><a href="/#articles">Articles</a><a href="/sitemap.xml">Sitemap</a>${phone}</nav></div></header>`;
}

function footer() {
  const business = getBusiness();
  return `<footer class="footer"><div class="wrap"><p><strong>${escapeHtml(business.name)}</strong> publishes practical exterior cleaning guides for homeowners and property managers across Southwestern Ohio.</p><p>Content is informational and should not replace an on-site evaluation. Generated pages are reviewed by automated quality rules but should be audited regularly for accuracy.</p></div></footer>`;
}

export function layout({ title, description, canonical, image, jsonLd = '', body, robots = 'index,follow' }) {
  const safeTitle = escapeHtml(title);
  const safeDescription = escapeHtml(description || 'Pressure washing and exterior cleaning guides for Southwestern Ohio.');
  const canonicalUrl = canonical || getSiteUrl();
  const imageUrl = image || absolute('/favicon.svg');
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="${escapeHtml(robots)}">
  <title>${safeTitle}</title>
  <meta name="description" content="${safeDescription}">
  <link rel="canonical" href="${escapeHtml(canonicalUrl)}">
  <link rel="alternate" type="application/rss+xml" title="Pressure Washing Articles" href="${absolute('/rss.xml')}">
  <meta property="og:title" content="${safeTitle}">
  <meta property="og:description" content="${safeDescription}">
  <meta property="og:type" content="website">
  <meta property="og:url" content="${escapeHtml(canonicalUrl)}">
  <meta property="og:image" content="${escapeHtml(imageUrl)}">
  <meta name="twitter:card" content="summary_large_image">
  <link rel="icon" href="/favicon.svg" type="image/svg+xml">
  <link rel="stylesheet" href="/styles.css">
  ${jsonLd}
</head>
<body>
  ${nav()}
  ${body}
  ${footer()}
</body>
</html>`;
}

function card(post) {
  const img = post.imageKey ? `/images/${post.imageKey}` : '/favicon.svg';
  return `<article class="card"><a href="/pressure-washing/${escapeHtml(post.slug)}"><img src="${escapeHtml(img)}" alt="${escapeHtml(post.title)}" loading="lazy"></a><div class="card-body"><div class="meta"><span>${escapeHtml(post.neighborhood || post.city || '')}</span><span>${escapeHtml(formatDate(post.publishedAt))}</span></div><h3><a href="/pressure-washing/${escapeHtml(post.slug)}">${escapeHtml(post.title)}</a></h3><p>${escapeHtml(post.excerpt || '')}</p><a href="/pressure-washing/${escapeHtml(post.slug)}">Read guide</a></div></article>`;
}

export function renderHome(posts = []) {
  const business = getBusiness();
  const latest = posts[0];
  const recent = posts.slice(0, 6);
  if (!latest) {
    return layout({
      title: `${business.name} Pressure Washing Guides`,
      description: 'Pressure washing and exterior cleaning guides for Southwestern Ohio.',
      canonical: getSiteUrl(),
      robots: 'noindex,follow',
      body: `<main class="wrap hero"><div class="empty"><h1>Pressure washing article engine is ready.</h1><p>Add your API keys in Netlify, then run the admin-generate function once or wait for the hourly scheduled function.</p></div></main>`
    });
  }

  const latestImage = latest.imageKey ? `/images/${latest.imageKey}` : '/favicon.svg';
  const body = `<main>
    <section class="hero" id="latest"><div class="wrap hero-grid"><div><div class="kicker">Latest Pressure Washing Guide</div><h1>${escapeHtml(latest.title)}</h1><p class="lede">${escapeHtml(latest.excerpt || latest.metaDescription || '')}</p><p class="meta"><span>${escapeHtml(latest.neighborhood || latest.city)}</span><span>${escapeHtml(latest.county || '')}</span><span>${escapeHtml(formatDate(latest.publishedAt))}</span></p><p><a class="btn" href="/pressure-washing/${escapeHtml(latest.slug)}">Read the Latest Guide</a></p></div><article class="hero-card"><img src="${escapeHtml(latestImage)}" alt="${escapeHtml(latest.title)}"><div class="hero-card-body"><h2>${escapeHtml(latest.city)} Exterior Cleaning Tips</h2><p>${escapeHtml(latest.metaDescription || '')}</p></div></article></div></section>
    <section class="section" id="articles"><div class="wrap"><div class="section-head"><div><div class="kicker">Recently Published</div><h2>Local pressure washing articles</h2></div><a href="/rss.xml">RSS</a></div><div class="grid">${recent.map(card).join('')}</div></div></section>
    <section class="section"><div class="wrap cta"><h2>Need curb appeal without the guesswork?</h2><p>${escapeHtml(business.name)} helps homeowners and property managers understand what needs pressure washing, soft washing, and seasonal exterior cleaning across Southwestern Ohio.</p><p><a class="btn" href="mailto:${escapeHtml(business.email || `info@${business.domain}`)}">Request a Quote</a></p></div></section>
  </main>`;

  const jsonLd = `<script type="application/ld+json">${JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: `${business.name} Pressure Washing Guides`,
    url: getSiteUrl(),
    publisher: { '@type': 'Organization', name: business.name, url: business.domain ? `https://${business.domain}` : getSiteUrl() }
  })}</script>`;

  return layout({
    title: `${latest.title} | ${business.name}`,
    description: latest.metaDescription,
    canonical: getSiteUrl(),
    image: absolute(latestImage),
    jsonLd,
    body
  });
}

export function renderPost(post, related = []) {
  const business = getBusiness();
  const imagePath = post.imageKey ? `/images/${post.imageKey}` : '/favicon.svg';
  const articleUrl = absolute(`/pressure-washing/${post.slug}`);
  const articleSections = [
    post.intro ? `<p>${escapeHtml(post.intro)}</p>` : '',
    ...(post.sections || []).map((section) => `<h2>${escapeHtml(section.heading)}</h2><p>${escapeHtml(section.body)}</p>`)
  ].join('');
  const faq = (post.faq || []).length ? `<section class="faq"><h2>Frequently asked questions</h2>${post.faq.map((item) => `<details><summary>${escapeHtml(item.question)}</summary><p>${escapeHtml(item.answer)}</p></details>`).join('')}</section>` : '';
  const tags = (post.tags || []).map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join('');
  const relatedCards = related.filter((item) => item.slug !== post.slug).slice(0, 3).map(card).join('');

  const jsonLdData = [
    {
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: post.title,
      description: post.metaDescription,
      image: absolute(imagePath),
      datePublished: post.publishedAt,
      dateModified: post.updatedAt || post.publishedAt,
      mainEntityOfPage: articleUrl,
      author: { '@type': 'Organization', name: business.name },
      publisher: { '@type': 'Organization', name: business.name, logo: { '@type': 'ImageObject', url: absolute('/favicon.svg') } }
    },
    ...(post.faq || []).length ? [{
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: post.faq.map((item) => ({
        '@type': 'Question',
        name: item.question,
        acceptedAnswer: { '@type': 'Answer', text: item.answer }
      }))
    }] : []
  ];
  const jsonLd = jsonLdData.map((item) => `<script type="application/ld+json">${JSON.stringify(item)}</script>`).join('\n');

  const body = `<main><section class="article-hero"><div class="wrap"><div class="kicker">${escapeHtml(post.neighborhood)} Pressure Washing</div><h1>${escapeHtml(post.title)}</h1><p class="lede">${escapeHtml(post.excerpt || post.metaDescription || '')}</p><p class="meta"><span>${escapeHtml(post.city)}</span><span>${escapeHtml(post.county)}</span><span>${escapeHtml(formatDate(post.publishedAt))}</span></p></div></section><section class="wrap article-shell"><article class="article"><img class="article-image" src="${escapeHtml(imagePath)}" alt="${escapeHtml(post.title)}"><div class="article-content">${articleSections}${faq}<div class="cta"><h2>Get the exterior cleaned the right way</h2><p>${escapeHtml(post.cta || `For pressure washing and soft washing guidance in ${post.city}, contact ${business.name} for a quote.`)}</p><p><a class="btn" href="mailto:${escapeHtml(business.email || `info@${business.domain}`)}">Request a Quote</a></p></div></div></article><aside class="sidebar"><div class="panel"><h3>Local focus</h3><p>${escapeHtml(post.neighborhood)}, ${escapeHtml(post.city)} in ${escapeHtml(post.county)}</p></div><div class="panel"><h3>Topics</h3><div class="tags">${tags}</div></div><div class="panel"><h3>Service note</h3><p>Pressure washing approach depends on surface age, drainage, staining, and nearby landscaping. Ask for an on-site review before choosing high pressure.</p></div></aside></section>${relatedCards ? `<section class="section"><div class="wrap"><div class="section-head"><h2>More local guides</h2></div><div class="grid">${relatedCards}</div></div></section>` : ''}</main>`;

  return layout({
    title: `${post.metaTitle} | ${business.name}`,
    description: post.metaDescription,
    canonical: articleUrl,
    image: absolute(imagePath),
    jsonLd,
    body
  });
}

export function renderNotFound(slug = '') {
  const attempted = slug ? `<p class="meta">Requested slug: ${escapeHtml(slug)}</p>` : '';
  return layout({
    title: 'Article not found',
    description: 'This pressure washing article could not be found.',
    robots: 'noindex,follow',
    body: `<main class="wrap hero"><div class="empty"><h1>Article not found</h1><p>The homepage can load before an article detail route cache catches up. Refresh once, or go back to the homepage and open the article again.</p>${attempted}<p><a class="btn" href="/">Back to latest articles</a></p></div></main>`
  });
}
