#!/usr/bin/env node
// Simplify a timezone boundary GeoJSON FeatureCollection so it is light enough
// to render in a browser or a single SVG. Uses Douglas-Peucker via jsts (already
// a project dependency) plus coordinate rounding.
//
// Usage:
//   node tools/simplify-geojson.js <input.geojson> [output.json] [tolerance] [decimals]
//
// Defaults: output=timezones-simplified.json, tolerance=0.02 (~2 km), decimals=3 (~110 m).
const fs = require('fs')
const jsts = require('jsts')

const [input, output = 'timezones-simplified.json', toleranceArg, decimalsArg] = process.argv.slice(2)

if (!input) {
  console.error('Usage: node tools/simplify-geojson.js <input.geojson> [output.json] [tolerance] [decimals]')
  process.exit(1)
}

const tolerance = toleranceArg === undefined ? 0.02 : parseFloat(toleranceArg)
const decimals = decimalsArg === undefined ? 3 : parseInt(decimalsArg, 10)

const reader = new jsts.io.GeoJSONReader()
const writer = new jsts.io.GeoJSONWriter()
const DouglasPeucker = jsts.simplify.DouglasPeuckerSimplifier

console.log('parsing', input, '...')
const collection = JSON.parse(fs.readFileSync(input))
console.log('features:', collection.features.length)

const factor = Math.pow(10, decimals)
const round = value => Math.round(value * factor) / factor
function roundCoords (coords) {
  if (typeof coords[0] === 'number') {
    return [round(coords[0]), round(coords[1])]
  }
  return coords.map(roundCoords)
}

let done = 0
const outFeatures = []
for (const feature of collection.features) {
  let geometry = reader.read(JSON.stringify(feature.geometry))
  geometry = DouglasPeucker.simplify(geometry, tolerance)
  if (geometry.isEmpty()) {
    console.warn('empty after simplify:', feature.properties.tzid)
    continue
  }
  const simplified = writer.write(geometry)
  simplified.coordinates = roundCoords(simplified.coordinates)
  outFeatures.push({
    type: 'Feature',
    properties: { tzid: feature.properties.tzid },
    geometry: simplified
  })
  if (++done % 100 === 0) {
    console.log('  simplified', done)
  }
}

fs.writeFileSync(output, JSON.stringify({ type: 'FeatureCollection', features: outFeatures }))
console.log('wrote', output, (fs.statSync(output).size / 1024 / 1024).toFixed(2), 'MB,', outFeatures.length, 'features')
