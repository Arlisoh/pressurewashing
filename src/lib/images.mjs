import { fal } from '@fal-ai/client';
import { DEFAULT_IMAGE_MODEL } from './config.mjs';
import { readFalKey } from './secrets.mjs';

// Pull the real failure reason out of a fal client error. The fal client throws
// ApiError objects where error.message is often just "Forbidden" or
// "Unprocessable Entity" and the useful detail lives in error.body.detail.
export function describeFalError(error) {
  const parts = [];
  if (error?.status) parts.push(`HTTP ${error.status}`);
  const detail = error?.body?.detail ?? error?.body;
  if (detail) {
    try {
      parts.push(typeof detail === 'string' ? detail : JSON.stringify(detail));
    } catch (_) {
      // ignore serialization issues
    }
  }
  if (error?.message && !parts.join(' ').includes(error.message)) {
    parts.push(error.message);
  }
  return (parts.filter(Boolean).join(' | ') || 'Unknown fal error').slice(0, 700);
}

function isRetryable(error) {
  const status = Number(error?.status || 0);
  if (status >= 500) return true; // fal-side hiccup
  if (status === 429) return true; // rate limited
  if (!status) return true; // network error / timeout, no HTTP status
  return false; // 401/403/422 etc. will not fix themselves, do not retry
}

function withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error(`${label} timed out after ${Math.round(ms / 1000)}s`)), ms);
    })
  ]);
}

function pickImageUrl(result) {
  const data = result?.data || result;
  if (Array.isArray(data?.images) && data.images.length > 0) {
    return data.images[0].url || data.images[0].content_url || data.images[0].file_url;
  }
  if (data?.image?.url) return data.image.url;
  if (data?.url) return data.url;
  return null;
}

export function buildImageInput(prompt, options = {}) {
  return {
    prompt,
    // Valid presets for openai/gpt-image-2 on fal:
    // square_hd, square, portrait_4_3, portrait_16_9, landscape_4_3, landscape_16_9, auto
    image_size: options.imageSize || process.env.IMAGE_SIZE || 'landscape_16_9',
    // low | medium | high. Default medium: high is the slowest and most
    // expensive tier and is overkill for blog headers.
    quality: options.quality || process.env.IMAGE_QUALITY || 'medium',
    num_images: 1,
    output_format: options.outputFormat || process.env.IMAGE_OUTPUT_FORMAT || 'jpeg'
  };
}

async function callFal(model, input, timeoutMs) {
  return withTimeout(fal.subscribe(model, { input, logs: true }), timeoutMs, `fal ${model}`);
}

export async function generateAndDownloadImage(prompt, options = {}) {
  const falKey = readFalKey();
  fal.config({ credentials: falKey.value });

  const model = process.env.FAL_IMAGE_MODEL || DEFAULT_IMAGE_MODEL;
  const input = buildImageInput(prompt, options);
  // GPT Image 2 can think for a while at higher quality. Cap it well inside the
  // 15 minute background function budget so saves always have time to run.
  const timeoutMs = Number(process.env.IMAGE_TIMEOUT_MS || 8 * 60 * 1000);

  let result;
  try {
    result = await callFal(model, input, timeoutMs);
  } catch (firstError) {
    const firstDescription = describeFalError(firstError);
    if (!isRetryable(firstError)) {
      const err = new Error(`fal image generation failed (${model}): ${firstDescription}`);
      err.falStatus = firstError?.status || null;
      throw err;
    }
    console.warn(`fal call failed, retrying once. Reason: ${firstDescription}`);
    await new Promise((resolve) => setTimeout(resolve, 4000));
    try {
      result = await callFal(model, input, timeoutMs);
    } catch (secondError) {
      const err = new Error(`fal image generation failed after retry (${model}): ${describeFalError(secondError)}`);
      err.falStatus = secondError?.status || null;
      throw err;
    }
  }

  const imageUrl = pickImageUrl(result);
  if (!imageUrl) {
    throw new Error(`fal returned a result but no image URL. Result keys: ${Object.keys(result?.data || result || {}).join(', ')}`);
  }

  const imageResponse = await fetch(imageUrl);
  if (!imageResponse.ok) {
    throw new Error(`Could not download generated image: HTTP ${imageResponse.status}`);
  }
  const contentType = imageResponse.headers.get('content-type') || 'image/jpeg';
  const arrayBuffer = await imageResponse.arrayBuffer();
  return { arrayBuffer, contentType, providerUrl: imageUrl, model };
}
