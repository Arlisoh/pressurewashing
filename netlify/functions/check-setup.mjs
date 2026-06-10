import { envDiagnostics } from '../../src/lib/secrets.mjs';
import { getSiteUrl, getBusiness, DEFAULT_CLAUDE_MODEL, DEFAULT_IMAGE_MODEL } from '../../src/lib/config.mjs';

export default async function handler(req) {
  try {
    const secret = process.env.ADMIN_GENERATE_SECRET;
    if (secret) {
      const url = new URL(req.url);
      const provided = req.headers.get('x-admin-secret') || url.searchParams.get('secret');
      if (provided !== secret) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }

    const diagnostics = envDiagnostics();
    return Response.json({
      ok: true,
      message: 'Safe setup check. No full secrets are shown here.',
      siteUrl: getSiteUrl(),
      business: getBusiness(),
      defaultClaudeModel: process.env.CLAUDE_MODEL || DEFAULT_CLAUDE_MODEL,
      defaultImageModel: process.env.FAL_IMAGE_MODEL || DEFAULT_IMAGE_MODEL,
      environment: diagnostics,
      nextStep: diagnostics.claude.present && diagnostics.fal.present
        ? 'Run /.netlify/functions/admin-generate?secret=YOUR_ADMIN_SECRET'
        : 'Add missing Netlify environment variables with Functions scope, then Trigger deploy.'
    });
  } catch (error) {
    console.error(error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
