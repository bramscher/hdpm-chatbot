# AppFolio Image API Reference

How Konmashi fetches property and unit-level images from AppFolio's Database API (v0). Use this as a blueprint for any project that needs AppFolio photos.

---

## Environment Variables Required

```env
APPFOLIO_CLIENT_ID=your_client_id
APPFOLIO_CLIENT_SECRET=your_client_secret
APPFOLIO_DEVELOPER_ID=your_developer_id
```

## API Base URL

```
https://api.appfolio.com/api/v0
```

**Auth:** Basic Auth (`ClientId:ClientSecret` base64-encoded) + `X-AppFolio-Developer-ID` header.

---

## Three Photo Endpoints

### 1. Property Photos (works for all property types)

```
GET /api/v0/properties/photos?filters[PropertyId]={propertyId}&page[number]=1&page[size]=1000
```

**Response:**
```json
{
  "data": [
    { "Id": "123", "Url": "https://s3.amazonaws.com/...", "Position": 1, "ContentType": "image/jpeg" }
  ],
  "next_page_path": null
}
```

- `Position` indicates display order. Position 1 (or the first item) is the primary/hero image.
- URLs are **presigned S3 URLs** that expire. Download and store them permanently if needed.

### 2. Marketing Photos (multi-family only)

```
GET /api/v0/properties/marketing-photos?filters[PropertyId]={propertyId}&page[number]=1&page[size]=1000
```

Same response shape as property photos. Only available for multi-family residential properties. **Will error for single-family properties** -- wrap in try/catch.

### 3. Unit Photos (individual unit images)

```
GET /api/v0/units/photos?filters[UnitId]={unitId}&page[number]=1&page[size]=1000
```

Same response shape. **Returns 422 for single-family properties** with a message like "use the property instead of the unit." Handle gracefully.

---

## Fetching Logic: Single-Family vs Multi-Family

The core decision tree (from `v0-lookup.ts`):

```
1. ALWAYS call getPropertyPhotos(propertyId)
   -> Works for both single-family and multi-family

2. TRY getPropertyMarketingPhotos(propertyId)
   -> Only succeeds for multi-family
   -> Catch and ignore errors for single-family

3. IF still no photos AND the property has units:
   -> Loop through up to 5 units calling getUnitPhotos(unitId)
   -> Stop at the first unit that returns photos
   -> getUnitPhotos returns 422 for single-family (catch and skip)

4. Cap at 16 photos max

5. If zero photos after all attempts, use a placeholder image
```

### TypeScript Implementation

```typescript
// Step 1: Property photos (always works)
const { data: propertyPhotos } = await getPropertyPhotos(propertyId);
for (const p of propertyPhotos) {
  if (p?.Url) {
    photos.push({
      url: p.Url,
      isPrimary: (p.Position ?? i) === 1 || i === 0,
      caption: undefined,
    });
  }
}

// Step 2: Marketing photos (multi-family only)
try {
  const { data: marketingPhotos } = await getPropertyMarketingPhotos(propertyId);
  for (const p of marketingPhotos) {
    if (p?.Url) photos.push({ url: p.Url, isPrimary: false, caption: undefined });
  }
} catch {
  // Not available for single-family; ignore
}

// Step 3: Fallback to unit photos if nothing found
if (photos.length === 0 && units.length > 0) {
  for (const u of units.slice(0, 5)) {
    try {
      const { data: unitPhotos } = await getUnitPhotos(u.Id);
      for (const p of unitPhotos) {
        if (p?.Url) photos.push({ url: p.Url, isPrimary: photos.length === 0, caption: undefined });
      }
      if (photos.length > 0) break; // Stop at first unit with photos
    } catch {
      // 422 for single-family; skip
    }
  }
}
```

---

## Making Authenticated Requests

All v0 endpoints use the same auth pattern:

```typescript
const APPFOLIO_V0_BASE = 'https://api.appfolio.com/api/v0';

async function v0Fetch<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const clientId = process.env.APPFOLIO_CLIENT_ID!;
  const clientSecret = process.env.APPFOLIO_CLIENT_SECRET!;
  const developerId = process.env.APPFOLIO_DEVELOPER_ID!;

  const url = new URL(`${APPFOLIO_V0_BASE}${path}`);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      Authorization: `Basic ${auth}`,
      'X-AppFolio-Developer-ID': developerId,
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`AppFolio v0 error: ${response.status} - ${text.slice(0, 300)}`);
  }

  return response.json() as Promise<T>;
}
```

---

## Helper: Getting Units for a Property

You need unit IDs to call `getUnitPhotos`. Fetch them first:

```
GET /api/v0/units?filters[PropertyId]={propertyId}&filters[LastUpdatedAtFrom]=1970-01-01T00:00:00Z&page[number]=1&page[size]=1000
```

Each unit object includes `Id`, `Bedrooms`, `Bathrooms`, `SquareFeet`, `ListedRent`, `MarketRent`, `RentReady`, `MarketingDescription`, `AvailableOn`, etc.

---

## Important Gotchas

| Issue | Detail |
|-------|--------|
| **S3 URLs expire** | AppFolio returns presigned S3 URLs. They are temporary. Download and store permanently if you need them beyond the current session. |
| **Single-family 422s** | `getUnitPhotos()` and `getPropertyMarketingPhotos()` return HTTP 422 for single-family properties. Always wrap in try/catch. |
| **Position field** | `Position` on property photos indicates display order. Position 1 = primary. Not all photos have this field. |
| **Pagination** | All endpoints support `page[number]` and `page[size]`. Most properties have <50 photos so `page[size]=1000` covers it. |
| **Rate limits** | AppFolio v0 API may rate limit. No official docs on limits -- be conservative with concurrent calls. |

---

## Permanent Storage Pattern (Optional)

If you need images to persist (e.g., for content generation), download from AppFolio's temporary S3 URLs and store in your own storage:

```typescript
async function downloadAndStore(imageUrl: string, storagePath: string): Promise<string> {
  // 1. Download from AppFolio's temporary S3 URL
  const res = await fetch(imageUrl);
  const buffer = Buffer.from(await res.arrayBuffer());

  // 2. Upload to your storage (Supabase example)
  await supabase.storage
    .from('your-bucket')
    .upload(storagePath, buffer, {
      contentType: 'image/jpeg',
      cacheControl: '31536000', // 1 year
      upsert: true,
    });

  // 3. Return permanent public URL
  const { data } = supabase.storage.from('your-bucket').getPublicUrl(storagePath);
  return data.publicUrl;
}
```

---

## Source Files in Konmashi

| File | Purpose |
|------|---------|
| `src/lib/appfolio/v0-client.ts` | Low-level API client -- auth, fetch wrapper, all 3 photo endpoints |
| `src/lib/appfolio/v0-lookup.ts` | Photo fetching logic with single-family vs multi-family branching |
| `src/lib/appfolio/library-integration.ts` | Downloads temporary S3 URLs and stores permanently in Supabase |
| `src/app/api/appfolio/property-photos-by-id/route.ts` | Next.js API route -- combined photo lookup |
| `src/app/api/appfolio/unit-photos-by-id/route.ts` | Next.js API route -- unit photo lookup |

---

## Quick Start Checklist

1. Set the 3 env vars (`APPFOLIO_CLIENT_ID`, `APPFOLIO_CLIENT_SECRET`, `APPFOLIO_DEVELOPER_ID`)
2. Copy the `v0Fetch` helper function
3. Implement the 3 photo-fetching functions (property, marketing, unit)
4. Use the decision tree: property photos -> marketing photos -> unit photo fallback
5. Wrap marketing and unit photo calls in try/catch for single-family compatibility
6. If persisting images, download from the temporary S3 URLs to your own storage
