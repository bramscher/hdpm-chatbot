import { NextRequest, NextResponse } from 'next/server';

/**
 * Proxies an AppFolio S3 image URL so the browser can fetch it
 * as a blob without CORS issues. Only allows AppFolio S3 URLs.
 */
export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get('url');

  if (!url) {
    return NextResponse.json({ error: 'url parameter required' }, { status: 400 });
  }

  // Only allow AppFolio S3 URLs
  if (!url.startsWith('https://s3.amazonaws.com/apm_prod')) {
    return NextResponse.json({ error: 'Invalid image URL' }, { status: 403 });
  }

  try {
    const res = await fetch(url);
    if (!res.ok) {
      return NextResponse.json({ error: 'Failed to fetch image' }, { status: res.status });
    }

    const buffer = await res.arrayBuffer();
    const contentType = res.headers.get('content-type') || 'image/jpeg';

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch {
    return NextResponse.json({ error: 'Proxy error' }, { status: 500 });
  }
}
