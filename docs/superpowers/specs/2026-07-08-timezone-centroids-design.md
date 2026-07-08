# Design: `timezone-names-with-centroids.json`

## Goal

Add a new release asset that pairs each IANA timezone id with a single
representative geographic point (the geocentroid of its boundary). This gives
consumers a lightweight name→location lookup (~16 KB) without needing to parse
the multi-megabyte GeoJSON/shapefile products.

## What exists today

`timezone-names.json` (~7.5 KB) is written by `writeBaseNames(false, …)` in
`index.js`. It is a flat JSON array of every timezone id in the comprehensive
dataset:

```json
["Africa/Abidjan", "Africa/Accra", ..., "Pacific/Wallis"]
```

It contains no geometry. Each zone's individual boundary is held in memory as a
`jsts` geometry in `finalZones[tzid]` after `loadFinalZonesIntoMemory()` runs
(inside the `validateZones` task).

## Output

New file in `distDir`: **`timezone-names-with-centroids.json`**

Shape — object keyed by tzid, value is `[lng, lat]` (GeoJSON coordinate order):

```json
{
  "America/New_York": [-78.62975, 37.72683],
  "Europe/London": [-3.35493, 54.7259]
}
```

- Coordinates rounded to 5 decimal places (~1 m), which is far finer than the
  centroid's meaningfulness and keeps the file small.
- Keys are every zone in the comprehensive dataset (`Object.keys(zoneCfg)`),
  mirroring `timezone-names.json`.
- Each point is the centroid of that individual zone's own boundary. Note that an
  IANA zone can be a large region (e.g. `America/New_York` is the whole US Eastern
  zone, so its centroid sits in Virginia), but each name maps to exactly one zone
  — there is no merging of same-timekeeping zones as happens in the "now"/"1970"
  name files.

## Centroid definition

Area-weighted centroid (center of mass) via `jsts` `Geometry.getCentroid()`.
`jsts` is already a dependency — **no new packages**. Computed in planar lng/lat
space.

Known caveat (documented, accepted): for concave, multi-part, or
antimeridian-crossing zones — notably the Antarctica zones that wrap the pole —
the centroid is a reasonable representative point but is not guaranteed to lie
*inside* the polygon. A guaranteed-inside "interior point" is available via jsts
but is not a true centroid, so it is out of scope for this "geocentroid" request.

## Approach (gentle / additive)

A single new, self-contained task in `index.js`'s `autoScript`, `makeCentroids`,
that depends on `validateZones` (which calls `loadFinalZonesIntoMemory`,
populating `finalZones` with each zone's individual boundary):

1. For each `tzid` in `zoneCfg` (the comprehensive zone list), take its boundary
   from the in-memory `finalZones[tzid]`.
2. Convert it to GeoJSON with the existing `geomToGeoJson` helper and pass it to
   the `util/centroid.js` helper (`geometryCentroid`).
3. Build `{ tzid: [round(lng), round(lat)] }` and write it to
   `distDir/timezone-names-with-centroids.json`.

No existing function or output file is modified, and no geometry is re-read from
disk (the in-memory `finalZones` are reused). Guarded by a new `--skip_centroids`
flag consistent with the other `--skip_*` options.

## Testing

A full build requires network + hours of processing, so verification is done in
two cheaper steps:

1. The `geometryCentroid` helper is checked against small GeoJSON fixtures with
   hand-checkable centroids (a square, a wide rectangle, a two-part MultiPolygon),
   asserting `[lng, lat]` order, 5-decimal rounding, and area-weighting.
2. The end-to-end lookup is confirmed against the released comprehensive GeoJSON
   for a real release (2026b): compute a centroid for every name and check that
   the keys line up 1:1 with the released `timezone-names.json` (419/419), that
   all coordinates are valid lng/lat, and that well-known zones land in the
   expected region (e.g. `Pacific/Honolulu` near Hawaii, `Europe/London` in the
   UK, `Asia/Tokyo` in Japan).

## Non-goals

- "Same since now" / "Same since 1970" and with-oceans centroid variants — the
  comprehensive set already covers every IANA name, and consumers can filter it
  using the existing merged-name files if they only want a subset.
- Modifying or replacing any existing `timezone-names*` file.
- Geodesic (spherical) centroid computation.
