/**
 * Cloudflare Pages Functions - High-Performance Google Drive Image Proxy & Edge Cache
 * Caching responses globally on Cloudflare's Edge (30 days) to protect Google Drive from quotas
 */

export async function onRequest(context) {
  const { request } = context;
  const url = new URL(request.url);
  const fileId = url.searchParams.get('id');
  const width = url.searchParams.get('w') || '1000';

  if (!fileId) {
    return new Response(JSON.stringify({ error: 'Missing file ID parameter' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }

  // Sanitize file ID to alphanumeric + hyphens/underscores only
  const cleanId = fileId.replace(/[^a-zA-Z0-9_-]/g, '');
  if (!cleanId) {
    return new Response(JSON.stringify({ error: 'Invalid file ID format' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }

  // Candidate Google endpoints in priority order
  const upstreamUrls = [
    `https://lh3.googleusercontent.com/d/${cleanId}=w${width}`,
    `https://drive.google.com/thumbnail?id=${cleanId}&sz=w${width}`,
    `https://drive.google.com/uc?export=view&id=${cleanId}`,
    `https://drive.google.com/uc?export=download&id=${cleanId}`
  ];

  for (const targetUrl of upstreamUrls) {
    try {
      const response = await fetch(targetUrl, {
        cf: {
          cacheTtl: 2592000, // Cache on Cloudflare Edge for 30 days
          cacheEverything: true
        },
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8'
        }
      });

      const contentType = response.headers.get('content-type') || '';

      // Verify that response is a valid image (not an HTML error page from Google)
      if (response.ok && (contentType.startsWith('image/') || contentType.includes('octet-stream'))) {
        const headers = new Headers(response.headers);
        headers.set('Cache-Control', 'public, max-age=2592000, s-maxage=2592000, immutable');
        headers.set('Access-Control-Allow-Origin', '*');
        headers.set('X-Edge-Cache', 'HIT-CLOUDFLARE');

        return new Response(response.body, {
          status: 200,
          headers: headers
        });
      }
    } catch (err) {
      // Continue to next upstream candidate
    }
  }

  // Redirect directly as a safe fallback if edge fetch fails
  return Response.redirect(`https://lh3.googleusercontent.com/d/${cleanId}=w${width}`, 302);
}
