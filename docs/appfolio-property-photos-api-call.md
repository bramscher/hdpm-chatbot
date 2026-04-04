# AppFolio Property Photos API Call — for Tech Support

## Request we send to AppFolio

**Method:** `GET`

**URL:**
```
https://api.appfolio.com/api/v0/properties/photos?filters[PropertyId]=d999eed4-f7c8-11f0-8ab6-12de4bf481cd&page[number]=1&page[size]=1000
```

**Headers:**
- `Authorization: Basic <base64(ClientId:ClientSecret)>`
- `X-AppFolio-Developer-ID: <our Developer ID>`
- `Accept: application/json`

**Query parameters:**
| Parameter | Value |
|-----------|--------|
| `filters[PropertyId]` | `d999eed4-f7c8-11f0-8ab6-12de4bf481cd` |
| `page[number]` | `1` |
| `page[size]` | `1000` |

**Property context:** 1963 Woodside 503, 63161 NE Hadley Place — Bend, OR 97701 (Multi-Family). We verified in the AppFolio app that this property has photos; the API returns no photos.

---

## Response we receive

To get the exact JSON from AppFolio, call our proxy with `include_raw=1` (while logged in):

```
GET /api/appfolio/v0/properties/photos?filters[PropertyId]=d999eed4-f7c8-11f0-8ab6-12de4bf481cd&include_raw=1
```

The response will include `raw_appfolio_response` (the JSON body from AppFolio) and `raw_appfolio_status` (HTTP status). Copy `raw_appfolio_response` below for the bug report.

Alternatively: Browser DevTools → Network → trigger Test Photos → select the `photos?filters[PropertyId]=...` request → Response tab.

**HTTP status:** 

**Response body (JSON):**
```json

```

---

## Expected vs actual

- **Expected:** `data` array containing photo objects (Id, PropertyId, Position, Url, ContentType) per the “List All Properties Photos” docs.
- **Actual:** *(describe what you get — e.g. 200 with `{ "data": [], "next_page_path": null }`)*
