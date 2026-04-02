import { NextRequest, NextResponse } from 'next/server';

const APPFOLIO_LISTINGS_BASE = 'https://highdesertpm.appfolio.com';

export interface UnitPhoto {
  id: string;
  url: string;
  thumbnail_url: string;
  caption: string;
  is_primary: boolean;
}

/**
 * Fetches photos for an AppFolio listing by scraping the public listings page.
 *
 * Flow:
 * 1. Fetch the AppFolio public listings index page
 * 2. Match the address to find the listing detail UUID
 * 3. Fetch the detail page and extract all CDN image URLs
 *
 * Images are served from images.cdn.appfolio.com in medium and large sizes.
 */
export async function GET(req: NextRequest) {
  const address = req.nextUrl.searchParams.get('address');

  if (!address) {
    return NextResponse.json(
      { error: 'address query parameter required' },
      { status: 400 }
    );
  }

  try {
    // Step 1: Fetch the public listings page
    const listingsRes = await fetch(`${APPFOLIO_LISTINGS_BASE}/listings`, {
      headers: { 'User-Agent': 'HDPM-Internal-Tool/1.0' },
    });

    if (!listingsRes.ok) {
      console.log(`[appfolio-photos] Listings page returned ${listingsRes.status}`);
      return NextResponse.json({ photos: [] });
    }

    const html = await listingsRes.text();

    // Step 2: Parse listings to find the matching detail UUID
    // Pattern: href="/listings/detail/{uuid}" followed by alt="{address}"
    const listingPattern = /href="\/listings\/detail\/([^"]+)"[^>]*>[\s\S]*?alt="([^"]+)"/g;
    let detailUuid: string | null = null;

    const normalizedSearch = normalizeAddress(address);

    let match;
    while ((match = listingPattern.exec(html)) !== null) {
      const uuid = match[1];
      const listingAddr = match[2];

      if (addressMatch(normalizedSearch, normalizeAddress(listingAddr))) {
        detailUuid = uuid;
        break;
      }
    }

    // Fallback: simpler pattern matching listing items
    if (!detailUuid) {
      // Each listing item has structure: <div id="listing_XXX"> ... detail/{uuid} ... alt="{address}"
      const itemPattern = /<div[^>]+class="listing-item[^"]*"[^>]*>[\s\S]*?href="\/listings\/detail\/([a-f0-9-]+)"[\s\S]*?alt="([^"]+)"/g;
      while ((match = itemPattern.exec(html)) !== null) {
        const uuid = match[1];
        const listingAddr = match[2];

        if (addressMatch(normalizedSearch, normalizeAddress(listingAddr))) {
          detailUuid = uuid;
          break;
        }
      }
    }

    if (!detailUuid) {
      console.log(`[appfolio-photos] No listing found matching address: ${address}`);
      return NextResponse.json({ photos: [] });
    }

    console.log(`[appfolio-photos] Found listing UUID: ${detailUuid} for ${address}`);

    // Step 3: Fetch the detail page and extract image URLs
    const detailRes = await fetch(
      `${APPFOLIO_LISTINGS_BASE}/listings/detail/${detailUuid}`,
      { headers: { 'User-Agent': 'HDPM-Internal-Tool/1.0' } }
    );

    if (!detailRes.ok) {
      console.log(`[appfolio-photos] Detail page returned ${detailRes.status}`);
      return NextResponse.json({ photos: [] });
    }

    const detailHtml = await detailRes.text();

    // Extract unique image UUIDs from CDN URLs
    // Pattern: https://images.cdn.appfolio.com/highdesertpm/images/{uuid}/large.jpg
    const imgPattern = /https:\/\/images\.cdn\.appfolio\.com\/highdesertpm\/images\/([a-f0-9-]+)\/(large|medium)\.\w+/g;
    const seenIds = new Set<string>();
    const photos: UnitPhoto[] = [];

    let imgMatch;
    while ((imgMatch = imgPattern.exec(detailHtml)) !== null) {
      const imageId = imgMatch[1];
      if (seenIds.has(imageId)) continue;
      seenIds.add(imageId);

      // Determine file extension from first match
      const extMatch = detailHtml.match(
        new RegExp(`images/${imageId}/(large|medium)\\.(\\w+)`)
      );
      const ext = extMatch ? extMatch[2] : 'jpg';

      photos.push({
        id: imageId,
        url: `https://images.cdn.appfolio.com/highdesertpm/images/${imageId}/large.${ext}`,
        thumbnail_url: `https://images.cdn.appfolio.com/highdesertpm/images/${imageId}/medium.${ext}`,
        caption: '',
        is_primary: photos.length === 0, // First image is primary
      });
    }

    console.log(`[appfolio-photos] Found ${photos.length} photos for ${address}`);

    return NextResponse.json({ photos });
  } catch (err) {
    console.error('[appfolio-photos] Error:', err);
    return NextResponse.json({ photos: [] });
  }
}

/**
 * Normalize an address for comparison:
 * lowercase, strip punctuation, collapse whitespace
 */
function normalizeAddress(addr: string): string {
  return addr
    .toLowerCase()
    .replace(/[.,#]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Check if two normalized addresses match.
 * Handles partial matches (e.g., "2634 SW 31st St" matching "2634 SW 31st St, Redmond, OR 97756")
 */
function addressMatch(search: string, candidate: string): boolean {
  // Exact match
  if (search === candidate) return true;
  // Search is contained in candidate (unit address without city/state)
  if (candidate.includes(search)) return true;
  // Candidate is contained in search
  if (search.includes(candidate)) return true;

  // Match on street number + street name (first 2-3 words)
  const searchWords = search.split(' ').slice(0, 4).join(' ');
  const candidateWords = candidate.split(' ').slice(0, 4).join(' ');
  return searchWords === candidateWords && searchWords.length > 5;
}
