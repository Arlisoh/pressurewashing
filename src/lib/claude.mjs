import { DEFAULT_CLAUDE_MODEL, getBusiness } from './config.mjs';
import { cleanSentence, slugify, truncate } from './text.mjs';
import { readClaudeApiKey } from './secrets.mjs';

function extractJson(text) {
  const trimmed = String(text || '').trim();
  try {
    return JSON.parse(trimmed);
  } catch (_) {
    const first = trimmed.indexOf('{');
    const last = trimmed.lastIndexOf('}');
    if (first >= 0 && last > first) {
      return JSON.parse(trimmed.slice(first, last + 1));
    }
    throw new Error('Claude did not return parseable JSON.');
  }
}

function normalizeArticle(raw, target) {
  const title = cleanSentence(raw.title || `${target.topic} in ${target.neighborhood}`);
  const metaTitle = truncate(cleanSentence(raw.metaTitle || title), 60);
  const metaDescription = truncate(cleanSentence(raw.metaDescription || raw.excerpt || title), 155);
  const slugBase = raw.slug || `${target.topic} ${target.neighborhood} ${target.city}`;
  const slug = slugify(slugBase);
  const sections = Array.isArray(raw.sections) ? raw.sections.slice(0, 6).map((section) => ({
    heading: cleanSentence(section.heading || ''),
    body: cleanSentence(section.body || '')
  })).filter((section) => section.heading && section.body) : [];
  const faq = Array.isArray(raw.faq) ? raw.faq.slice(0, 5).map((item) => ({
    question: cleanSentence(item.question || ''),
    answer: cleanSentence(item.answer || '')
  })).filter((item) => item.question && item.answer) : [];

  return {
    title,
    slug,
    metaTitle,
    metaDescription,
    excerpt: truncate(cleanSentence(raw.excerpt || metaDescription), 240),
    intro: cleanSentence(raw.intro || ''),
    sections,
    faq,
    cta: cleanSentence(raw.cta || ''),
    imagePrompt: cleanSentence(raw.imagePrompt || `Professional realistic photo of pressure washing a clean concrete driveway in ${target.neighborhood}, ${target.city}, Ohio, bright natural light, no text.`),
    tags: Array.isArray(raw.tags) ? raw.tags.map(cleanSentence).filter(Boolean).slice(0, 8) : [],
    keywords: Array.isArray(raw.keywords) ? raw.keywords.map(cleanSentence).filter(Boolean).slice(0, 12) : [],
    city: target.city,
    county: target.county,
    neighborhood: target.neighborhood,
    topic: target.topic
  };
}

export async function generateArticleWithClaude(target, existingPosts = []) {
  const claudeKey = readClaudeApiKey();
  const apiKey = claudeKey.value;

  const business = getBusiness();
  const recentTitles = existingPosts.slice(0, 20).map((post) => `- ${post.title}`).join('\n');
  const system = `You are an expert local SEO copywriter and exterior cleaning professional. Write useful, specific, people-first content. Do not fabricate statistics, awards, reviews, emergency availability, guarantees, licenses, or exact prices. Do not keyword-stuff. Avoid em dashes. Return valid JSON only.`;
  const user = `Create one high-quality local pressure washing article for this business and location.

Business:
- Name: ${business.name}
- Domain: ${business.domain}
- Service area: ${business.city}
- Services: ${business.services}

Target:
- City: ${target.city}
- County: ${target.county}
- Neighborhood or area: ${target.neighborhood}
- Article topic: ${target.topic}

Recently published titles to avoid repeating:
${recentTitles || '- none yet'}

Requirements:
- 900 to 1,200 words total.
- The content must help a homeowner or property manager decide what to clean, what can go wrong, and when to call a pro.
- Include local context that is stable and general: Ohio weather, winter salt, shaded surfaces, mature trees, concrete, siding, patios, pool decks, sidewalks, and curb appeal.
- Do not claim the business has a physical office in the target city unless provided.
- Do not mention exact chemical names or instructions that could cause damage.
- Include a natural call to action for a quote.
- Use plain English and no em dashes.
- Return this exact JSON shape:
{
  "title": "",
  "slug": "",
  "metaTitle": "",
  "metaDescription": "",
  "excerpt": "",
  "intro": "",
  "sections": [
    { "heading": "", "body": "" }
  ],
  "faq": [
    { "question": "", "answer": "" }
  ],
  "cta": "",
  "imagePrompt": "realistic photo prompt, no text in image",
  "tags": [],
  "keywords": []
}`;

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: process.env.CLAUDE_MODEL || DEFAULT_CLAUDE_MODEL,
      max_tokens: Number(process.env.CLAUDE_MAX_TOKENS || 5500),
      temperature: Number(process.env.CLAUDE_TEMPERATURE || 0.65),
      system,
      messages: [{ role: 'user', content: user }]
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    const safeKeyInfo = `${claudeKey.name}, length ${claudeKey.summary.length}, starts ${claudeKey.summary.startsWith}, ends ${claudeKey.summary.endsWith}`;
    if (response.status === 401) {
      throw new Error(`Claude API 401 invalid key. Netlify is sending a key from ${safeKeyInfo}. Create a brand new Claude API key, paste the full sk-ant... value into Netlify as CLAUDE_API_KEY, save, then Trigger deploy. Anthropic response: ${errorText.slice(0, 500)}`);
    }
    throw new Error(`Claude API error ${response.status}. Key source: ${safeKeyInfo}. Response: ${errorText.slice(0, 600)}`);
  }

  const data = await response.json();
  if (data.stop_reason === 'max_tokens') {
    throw new Error('Claude hit the max_tokens limit before finishing the article JSON. Raise CLAUDE_MAX_TOKENS in Netlify environment variables (try 7000).');
  }
  const text = data.content?.filter((block) => block.type === 'text').map((block) => block.text).join('\n') || '';
  const raw = extractJson(text);
  return normalizeArticle(raw, target);
}
