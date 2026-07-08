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
- Keys are the canonical zones that key `timezone-names-Now.json`
  (`Object.keys(zoneCfgNow)`).
- The point is the centroid of the **named zone's own (comprehensive) boundary**,
  NOT of the larger set of zones merged into it under the "now" grouping. For
  example `America/New_York` represents 15 merged zones in the "now" dataset, but
  its centroid is computed from New York's individual boundary alone so the point
  stays in New York rather than being pulled north into Canada by the merged set.

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
`makeNowCentroids`, that depends on `validateZones` (which calls
`loadFinalZonesIntoMemory`, populating `finalZones` with each zone's individual
boundary):

1. For each `tzid` in `zoneCfgNow` (the keys of the "now" names file), take its
   individual boundary from the in-memory `finalZones[tzid]`.
2. Convert it to GeoJSON with the existing `geomToGeoJson` helper and pass it to
   the `util/centroid.js` helper (`geometryCentroid`).
3. Build `{ tzid: [round(lng), round(lat)] }` and write it to
   `distDir/timezone-names-Now-with-centroids.json`.

No existing function or output file is modified, and no geometry is re-read from
disk (the in-memory `finalZones` are reused). Guarded by the existing
`--skip_now_zones` flag plus a new `--skip_now_centroids` flag consistent with
the other `--skip_*` options.

## Testing

A full build requires network + hours of processing, so verification is done in
two cheaper steps:

1. The `geometryCentroid` helper is checked against small GeoJSON fixtures with
   hand-checkable centroids (a square, a wide rectangle, a two-part MultiPolygon),
   asserting `[lng, lat]` order, 5-decimal rounding, and area-weighting.
2. The end-to-end lookup is confirmed against the released comprehensive GeoJSON
   for a real release (2026b): compute a centroid for every "now" name and check
   the keys line up with the released `timezone-names-Now.json` and that
   well-known zones land in the expected region (e.g. `America/New_York` in New
   York State, `Pacific/Honolulu` near Hawaii).

## Non-goals

- Other products (comprehensive, 1970) and with-oceans variants — not requested.
- Modifying or replacing `timezone-names-Now.json`.
- Geodesic (spherical) centroid computation.
