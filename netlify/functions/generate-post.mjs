import { generatePost } from '../../src/lib/generator.mjs';

export default async function handler() {
  try {
    const result = await generatePost({ force: false });
    return Response.json(result, { status: result.skipped ? 200 : 201 });
  } catch (error) {
    console.error(error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}

export const config = {
  schedule: '@hourly'
};
