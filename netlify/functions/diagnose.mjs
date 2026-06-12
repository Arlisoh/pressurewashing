import { fal } from '@fal-ai/client';
import { requireAdmin } from '../../src/lib/auth.mjs';
import { readClaudeApiKey, readFalKey } from '../../src/lib/secrets.mjs';
import { DEFAULT_CLAUDE_MODEL, DEFAULT_IMAGE_MODEL } from '../../src/lib/config.mjs';
import { describeFalError } from '../../src/lib/images.mjs';

// Live end-to-end credential test. Makes one tiny Claude call and submits one
// low-quality fal image job, then reports the raw outcome of each. Costs about
// a cent per visit. This is the fastest way to see WHY fal is rejecting you.
// URL: /.netlify/functions/diagnose?secret=YOUR_ADMIN_SECRET
export default async function handler(req) {
  const unauthorized = requireAdmin(req);
  if (unauthorized) return unauthorized;

  const report = {
    note: 'Live credential test. Each visit makes one tiny Claude call and submits one low-quality fal image job.'
  };

  // ---- Claude ----
  try {
    const claudeKey = readClaudeApiKey();
    const model = process.env.CLAUDE_MODEL || DEFAULT_CLAUDE_MODEL;
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': claudeKey.value,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model,
        max_tokens: 16,
        messages: [{ role: 'user', content: 'Reply with the single word: ok' }]
      })
    });
    const bodyText = await res.text();
    report.claude = {
      ok: res.ok,
      status: res.status,
      model,
      detail: res.ok ? 'Claude API key and model are working.' : bodyText.slice(0, 400)
    };
  } catch (error) {
    report.claude = { ok: false, detail: error.message };
  }

  // ---- fal / GPT Image 2 ----
  // Submit to the queue and poll briefly. Auth, billing, and validation errors
  // surface immediately at submit time, which is exactly what we need to see.
  const imageModel = process.env.FAL_IMAGE_MODEL || DEFAULT_IMAGE_MODEL;
  try {
    const falKey = readFalKey();
    fal.config({ credentials: falKey.value });
    const { request_id: requestId } = await fal.queue.submit(imageModel, {
      input: {
        prompt: 'A clean concrete residential driveway on a sunny day, photorealistic',
        image_size: 'square',
        quality: 'low',
        num_images: 1,
        output_format: 'jpeg'
      }
    });

    let finalStatus = 'SUBMITTED';
    let imageUrl = null;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      const status = await fal.queue.status(imageModel, { requestId, logs: false });
      finalStatus = status?.status || finalStatus;
      if (finalStatus === 'COMPLETED') {
        const result = await fal.queue.result(imageModel, { requestId });
        imageUrl = result?.data?.images?.[0]?.url || null;
        break;
      }
    }

    report.fal = {
      ok: true,
      model: imageModel,
      requestId,
      queueStatus: finalStatus,
      imageUrl,
      detail: finalStatus === 'COMPLETED'
        ? 'fal accepted the job and generated an image. Image pipeline is healthy.'
        : 'fal accepted the job (key and billing are valid) and it is still generating. That is a pass.'
    };
  } catch (error) {
    report.fal = {
      ok: false,
      model: imageModel,
      status: error?.status || null,
      detail: describeFalError(error),
      hint: 'A 401 means the FAL_KEY value in Netlify is wrong. A 403 usually means the fal account has no balance or billing set up. Check https://fal.ai/dashboard. A 404 means the model id in FAL_IMAGE_MODEL is wrong.'
    };
  }

  report.ok = Boolean(report.claude?.ok && report.fal?.ok);
  report.nextStep = report.ok
    ? 'Both APIs work. Visit /.netlify/functions/admin-generate?secret=... to publish a post now, or just wait for the hourly run.'
    : 'Fix the failing credential above in Netlify > Site configuration > Environment variables, then Deploys > Trigger deploy > Deploy site, then reload this page.';
  return Response.json(report);
}
