#!/usr/bin/env node
// Build a self-contained, interactive Leaflet map of timezone boundaries with a
// toggleable centroid layer. The boundary and centroid data are inlined into the
// page, so the only network dependency is the Leaflet CDN asset.
//
// Usage:
//   node tools/build-centroids-html.js <boundaries.geojson> <centroids.json> [output.html]
//
// <boundaries.geojson> is a FeatureCollection (ideally simplified first with
// simplify-geojson.js); <centroids.json> is an object of { tzid: [lng, lat] }.
const fs = require('fs')

const [boundariesPath, centroidsPath, output = 'render-centroids.html'] = process.argv.slice(2)

if (!boundariesPath || !centroidsPath) {
  console.error('Usage: node tools/build-centroids-html.js <boundaries.geojson> <centroids.json> [output.html]')
  process.exit(1)
}

const boundaries = fs.readFileSync(boundariesPath, 'utf8')
const centroids = fs.readFileSync(centroidsPath, 'utf8')
const nCentroids = Object.keys(JSON.parse(centroids)).length

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Timezone centroids</title>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css">
<style>
  html, body { margin: 0; height: 100%; }
  #map { height: 100%; background: #eaeef2; }
  .panel {
    position: absolute; z-index: 1000; top: 10px; left: 50px;
    background: #fff; padding: 8px 12px; border-radius: 6px;
    font: 13px/1.35 system-ui, sans-serif; box-shadow: 0 1px 5px rgba(0,0,0,.35);
  }
  .panel b { font-size: 14px; }
  .panel span { color: #666; }
</style>
</head>
<body>
<div id="map"></div>
<div class="panel"><b>Timezone centroids</b><br><span>${nCentroids} zones &middot; red dots = geocentroid, click for id</span></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>window.TZ_BOUNDARIES = ${boundaries};</script>
<script>window.TZ_CENTROIDS = ${centroids};</script>
<script>
  const map = L.map('map', { minZoom: 1, worldCopyJump: false, attributionControl: false }).setView([25, 0], 2);

  let i = 0;
  const boundaryLayer = L.geoJSON(window.TZ_BOUNDARIES, {
    style: function () {
      const h = (i++ * 137.508) % 360;
      return { stroke: true, color: '#5a5a5a', weight: 0.3, fillColor: 'hsl(' + h + ',55%,68%)', fillOpacity: 0.65 };
    }
  }).addTo(map);

  const centroidLayer = L.layerGroup();
  Object.entries(window.TZ_CENTROIDS).forEach(function (e) {
    const tzid = e[0], lng = e[1][0], lat = e[1][1];
    L.circleMarker([lat, lng], {
      radius: 3, color: '#a00000', weight: 1, fillColor: '#ff2a2a', fillOpacity: 0.95
    }).bindPopup('<b>' + tzid + '</b><br>[' + lng + ', ' + lat + ']').addTo(centroidLayer);
  });
  centroidLayer.addTo(map);

  L.control.layers(null, { 'Timezone boundaries': boundaryLayer, 'Centroids': centroidLayer }, { collapsed: false }).addTo(map);
</script>
</body>
</html>
`

fs.writeFileSync(output, html)
console.log('wrote', output, (Buffer.byteLength(html) / 1024 / 1024).toFixed(2), 'MB;', nCentroids, 'centroids')
