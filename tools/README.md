# Centroid visualization tools

Small, dependency-light scripts for visualizing the timezone boundaries together
with the per-zone geocentroids produced by the build (the
`timezone-names-with-centroids.json` lookup, or any `{ tzid: [lng, lat] }` object).

These are standalone helpers — nothing in the build depends on them. They take
file paths as arguments so you can point them at either freshly built output or
files downloaded from a [release](https://github.com/evansiroky/timezone-boundary-builder/releases).

## Pipeline

1. **Simplify the boundaries** so they are light enough to draw. Point this at a
   combined boundary GeoJSON (for example `combined.json` from a release):

   ```sh
   node tools/simplify-geojson.js combined.json timezones-simplified.json
   ```

   Optional trailing args are `tolerance` (degrees, default `0.02`) and `decimals`
   (default `3`). Uses `jsts`, which is already a project dependency, so run
   `npm install` first.

2. **Render a static SVG** (equirectangular, self-contained, no browser):

   ```sh
   node tools/render-centroids-svg.js timezones-simplified.json timezone-names-with-centroids.json centroids-map.svg
   ```

   The SVG uses hex fills, so it rasterizes cleanly to PNG with any SVG renderer
   (e.g. `librsvg` / `sharp`).

3. **Or build an interactive Leaflet map** (boundaries + a toggleable centroid
   layer, data inlined; loads Leaflet from a CDN):

   ```sh
   node tools/build-centroids-html.js timezones-simplified.json timezone-names-with-centroids.json render-centroids.html
   ```

Each red dot is the area-weighted centroid of that zone's own boundary; click a
dot (HTML) or hover it (SVG) to see the `tzid` and coordinates.
