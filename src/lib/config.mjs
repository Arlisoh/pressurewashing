export function env(name, fallback = '') {
  const value = process.env[name];
  return value === undefined || value === null || value === '' ? fallback : value;
}

export function getSiteUrl() {
  return env('SITE_URL', env('URL', 'https://example.com')).replace(/\/$/, '');
}

export function getBusiness() {
  return {
    name: env('BUSINESS_NAME', 'Clean Home Services'),
    domain: env('BUSINESS_DOMAIN', 'cleanhome.services'),
    phone: env('BUSINESS_PHONE', ''),
    email: env('BUSINESS_EMAIL', ''),
    city: env('BUSINESS_CITY', 'Southwestern Ohio'),
    services: env('BUSINESS_SERVICES', 'driveway pressure washing, concrete cleaning, patio cleaning, pool deck cleaning, house soft washing, siding cleaning, fence cleaning, deck cleaning, and commercial exterior cleaning')
  };
}

export const DEFAULT_CLAUDE_MODEL = 'claude-sonnet-4-6';
export const DEFAULT_IMAGE_MODEL = 'openai/gpt-image-2';
