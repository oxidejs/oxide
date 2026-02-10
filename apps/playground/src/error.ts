import type { H3Event } from "nitro/h3";

async function handleError(error: Error, _event: H3Event) {
  return new Response(`Error: ${error.message}`, { status: 500 });
}

export default handleError;
