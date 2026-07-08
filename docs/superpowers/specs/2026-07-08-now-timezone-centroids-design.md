# Design: `timezone-names-Now-with-centroids.json`

## Goal

Add a new release asset that pairs each "Now" IANA timezone id with a single
representative geographic point (the geocentroid of its boundary). This gives
consumers a lightweight name→location lookup (a few KB) without needing to
parse the multi-megabyte GeoJSON/shapefile products.

## What exists today

`timezone-names-Now.json` (~8.8 KB) is written by `writeCombinedZoneLookup('Now',
zoneCfgNow, false, …)` in `index.js`. It is a JSON object keyed by the canonical
"Now" tzid, whose value is the list of tzids that keep identical time since now:

```json
{ "America/New_York": ["America/New_York", "America/Detroit", ...], ... }
```

It contains no geometry. The actual "Now" boundaries (without oceans, merged per
canonical zone) are written during `combineAndWriteZones` to
`workingDir/combined-now.json` — a standard GeoJSON `FeatureCollection` with one
`Feature` per canonical tzid: `{ properties: { tzid }, geometry }`.

## Output

New file in `distDir`: **`timezone-names-Now-with-centroids.json`**

Shape — object keyed by tzid, value is `[lng, lat]` (GeoJSON coordinate order):

```json
{
  "America/New_York": [-76.20, 42.75],
  "Europe/London": [-1.98, 52.88]
}
```

- Coordinates rounded to 5 decimal places (~1 m), which is far finer than the
  centroid's meaningfulness and keeps the file small.
- Keys mirror the features present in `combined-now.json`, which are the same
  canonical zones that key `timezone-names-Now.json`.

## Centroid definition

Area-weighted centroid (center of mass) via `jsts` `Geometry.getCentroid()`.
`jsts` is already a dependency — **no new packages**. Computed in planar lng/lat
space.

Known caveat (documented, accepted): for concave, multi-part, or
antimeridian-crossing zones the centroid is a reasonable representative point but
is not guaranteed to lie *inside* the polygon. A guaranteed-inside "interior
point" is available via jsts but is not a true centroid, so it is out of scope
for this "geocentroid" request.

## Approach (gentle / additive)

A single new, self-contained task in `index.js`'s `autoScript`,
`makeNowCentroids`, that depends on `mergeAndWriteZones` (so the combined file is
already on disk):

1. Read `workingDir/combined-now.json`.
2. For each feature, convert its geometry to a jsts geometry (reusing the
   existing `geoJsonToGeom` helper) and call `.getCentroid()`.
3. Build `{ tzid: [round(lng), round(lat)] }` and write it to
   `distDir/timezone-names-Now-with-centroids.json`.

No existing function or output file is modified. Guarded by the existing
`--skip_now_zones` flag (if now zones are skipped there is no `combined-now.json`
to read) plus a new `--skip_now_centroids` flag consistent with the other
`--skip_*` options.

## Testing

Since a full build requires network + hours of processing, the centroid logic is
verified in isolation against a small GeoJSON fixture (known shapes with
hand-checkable centroids: a square, an L-shape, a two-part MultiPolygon), asserting
`[lng, lat]` order, rounding, and area-weighting. This keeps the change verifiable
without running the whole pipeline.

## Non-goals

- Other products (comprehensive, 1970) and with-oceans variants — not requested.
- Modifying or replacing `timezone-names-Now.json`.
- Geodesic (spherical) centroid computation.
