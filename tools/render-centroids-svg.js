#!/usr/bin/env node
// Render timezone boundaries plus their centroids to a single self-contained SVG
// (equirectangular projection). No dependencies, no browser required, so the
// output can be committed or rasterized (for example with librsvg / sharp).
//
// Usage:
//   node tools/render-centroids-svg.js <boundaries.geojson> <centroids.json> [output.svg]
//
// <boundaries.geojson> is a FeatureCollection (ideally simplified first with
// simplify-geojson.js); <centroids.json> is an object of { tzid: [lng, lat] }.
const fs = require('fs')

const [boundariesPath, centroidsPath, output = 'centroids-map.svg'] = process.argv.slice(2)

if (!boundariesPath || !centroidsPath) {
  console.error('Usage: node tools/render-centroids-svg.js <boundaries.geojson> <centroids.json> [output.svg]')
  process.exit(1)
}

const boundaries = JSON.parse(fs.readFileSync(boundariesPath))
const centroids = JSON.parse(fs.readFileSync(centroidsPath))

const W = 2400
const H = 1200
const x = lng => ((lng + 180) / 360) * W
const y = lat => ((90 - lat) / 180) * H
const r = n => Math.round(n * 10) / 10

// HSL -> hex so browsers and standalone SVG rasterizers agree on the colors.
function hslHex (h, s, l) {
  const a = s * Math.min(l, 1 - l)
  const f = n => {
    const k = (n + h / 30) % 12
    const c = l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))
    return Math.round(255 * c).toString(16).padStart(2, '0')
  }
  return '#' + f(0) + f(8) + f(4)
}

// Build an SVG path for one ring, breaking the subpath at antimeridian jumps
// (|Δlng| > 180) so wrap-around zones don't streak across the map.
function ringPath (ring) {
  let d = ''
  let prevLng = null
  ring.forEach(([lng, lat], idx) => {
    const cmd = (idx === 0 || (prevLng !== null && Math.abs(lng - prevLng) > 180)) ? 'M' : 'L'
    d += cmd + r(x(lng)) + ' ' + r(y(lat)) + ' '
    prevLng = lng
  })
  return d
}

function featurePath (geom) {
  const polys = geom.type === 'Polygon' ? [geom.coordinates] : geom.coordinates
  let d = ''
  polys.forEach(poly => poly.forEach(ring => { d += ringPath(ring) + 'Z ' }))
  return d.trim()
}

let paths = ''
let i = 0
for (const feature of boundaries.features) {
  const h = (i++ * 137.508) % 360
  paths += `<path d="${featurePath(feature.geometry)}" fill="${hslHex(h, 0.55, 0.68)}" fill-opacity="0.7" stroke="#5a5a5a" stroke-width="0.4"><title>${feature.properties.tzid}</title></path>\n`
}

let dots = ''
for (const [tzid, [lng, lat]] of Object.entries(centroids)) {
  dots += `<circle cx="${r(x(lng))}" cy="${r(y(lat))}" r="3" fill="#ff2a2a" stroke="#7a0000" stroke-width="0.6"><title>${tzid} [${lng}, ${lat}]</title></circle>\n`
}

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" font-family="system-ui,sans-serif">
<rect width="${W}" height="${H}" fill="#eef1f4"/>
<g>${paths}</g>
<g>${dots}</g>
<text x="20" y="34" font-size="26" font-weight="700" fill="#222">Timezone geocentroids</text>
<text x="20" y="58" font-size="16" fill="#555">${Object.keys(centroids).length} IANA zones &#183; red = geocentroid of each zone's boundary</text>
</svg>
`

fs.writeFileSync(output, svg)
console.log('wrote', output, (Buffer.byteLength(svg) / 1024 / 1024).toFixed(2), 'MB')
