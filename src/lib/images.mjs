import { fal } from '@fal-ai/client';
import { DEFAULT_IMAGE_MODEL } from './config.mjs';

function pickImageUrl(result) {
  const data = result?.data || result;
  if (Array.isArray(data?.images) && data.images.length > 0) {
    return data.images[0].url || data.images[0].content_url || data.images[0].file_url;
  }
  if (data?.image?.url) return data.image.url;
  if (data?.url) return data.url;
  return null;
}

export async function generateAndDownloadImage(prompt) {
  if (!process.env.FAL_KEY) {
    throw new Error('Missing FAL_KEY. Add it in Netlify environment variables with Functions scope.');
  }

  const model = process.env.FAL_IMAGE_MODEL || DEFAULT_IMAGE_MODEL;
  const result = await fal.subscribe(model, {
    input: {
      prompt,
      image_size: process.env.IMAGE_SIZE || 'landscape_16_9',
      quality: process.env.IMAGE_QUALITY || 'high',
      num_images: 1,
      output_format: process.env.IMAGE_OUTPUT_FORMAT || 'png'
    },
    logs: true
  });

  const imageUrl = pickImageUrl(result);
  if (!imageUrl) {
    throw new Error(`fal image generation succeeded but did not return an image URL. Result keys: ${Object.keys(result?.data || result || {}).join(', ')}`);
  }

  const imageResponse = await fetch(imageUrl);
  if (!imageResponse.ok) {
    throw new Error(`Could not download generated image: ${imageResponse.status}`);
  }
  const contentType = imageResponse.headers.get('content-type') || 'image/png';
  const arrayBuffer = await imageResponse.arrayBuffer();
  return { arrayBuffer, contentType, providerUrl: imageUrl, model };
}
