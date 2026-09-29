import { pipelineCss } from '@/lib/pipelines/css';

// Pipeline chip colours as a same-origin stylesheet. `style-src 'self'` allows
// it with no nonce, so it survives client-side navigation (an inline <style>
// would carry a new request's nonce and be blocked). Behind the proxy like
// every app route: signed-in staff only.
export const dynamic = 'force-dynamic';

export async function GET() {
  const { css } = await pipelineCss();
  return new Response(css, {
    headers: { 'Content-Type': 'text/css; charset=utf-8', 'Cache-Control': 'private, max-age=300' },
  });
}
