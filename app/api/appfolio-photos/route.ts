import { NextRequest, NextResponse } from 'next/server';

const APPFOLIO_V0_BASE = 'https://api.appfolio.com/api/v0';

interface V0UnitImage {
  Id: string;
  Url?: string;
  OriginalUrl?: string;
  ThumbnailUrl?: string;
  Caption?: string;
  IsPrimary?: boolean;
}

interface V0ListResponse<T> {
  data: T[];
  next_page_path?: string | null;
}

export interface UnitPhoto {
  id: string;
  url: string;
  thumbnail_url: string;
  caption: string;
  is_primary: boolean;
}

/**
 * Fetches photos for a given AppFolio unit.
 * The v0 API exposes /units/{id}/images for properties that have photos uploaded.
 * Falls back gracefully if the endpoint isn't available.
 */
export async function GET(req: NextRequest) {
  const unitId = req.nextUrl.searchParams.get('unit_id');
  const propertyId = req.nextUrl.searchParams.get('property_id');

  if (!unitId && !propertyId) {
    return NextResponse.json(
      { error: 'unit_id or property_id query parameter required' },
      { status: 400 }
    );
  }

  const clientId = process.env.APPFOLIO_CLIENT_ID;
  const clientSecret = process.env.APPFOLIO_CLIENT_SECRET;
  const developerId = process.env.APPFOLIO_DEVELOPER_ID;

  if (!clientId || !clientSecret || !developerId) {
    return NextResponse.json(
      { error: 'AppFolio API credentials not configured' },
      { status: 500 }
    );
  }

  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  const photos: UnitPhoto[] = [];

  // Try fetching unit images
  const endpoints = [];
  if (unitId) endpoints.push(`/units/${unitId}/images`);
  if (propertyId) endpoints.push(`/properties/${propertyId}/images`);

  for (const endpoint of endpoints) {
    try {
      const url = new URL(`${APPFOLIO_V0_BASE}${endpoint}`);
      url.searchParams.set('page[number]', '1');
      url.searchParams.set('page[size]', '50');

      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          Authorization: `Basic ${auth}`,
          'X-AppFolio-Developer-ID': developerId,
          Accept: 'application/json',
        },
      });

      if (!response.ok) {
        // Endpoint may not exist for this API version — skip silently
        continue;
      }

      const data = (await response.json()) as V0ListResponse<V0UnitImage>;

      for (const img of data.data || []) {
        const imgUrl = img.OriginalUrl || img.Url || '';
        if (!imgUrl) continue;

        photos.push({
          id: img.Id,
          url: imgUrl,
          thumbnail_url: img.ThumbnailUrl || imgUrl,
          caption: img.Caption || '',
          is_primary: img.IsPrimary || false,
        });
      }

      // If we got photos from the first endpoint, no need to try the second
      if (photos.length > 0) break;
    } catch {
      // Silently continue — endpoint may not exist
    }
  }

  // Sort: primary first, then by id
  photos.sort((a, b) => {
    if (a.is_primary && !b.is_primary) return -1;
    if (!a.is_primary && b.is_primary) return 1;
    return a.id.localeCompare(b.id);
  });

  return NextResponse.json({ photos });
}
