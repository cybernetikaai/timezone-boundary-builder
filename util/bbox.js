/**
 * Compute the bounding box of a GeoJSON geometry as
 * [minLng, minLat, maxLng, maxLat] (GeoJSON bbox order), rounded to `decimals`
 * places.
 *
 * The box is computed in planar lng/lat with no antimeridian handling. A zone
 * whose parts straddle the 180° meridian (for example some Pacific zones) is
 * represented as separate rings near +180 and -180, so its box spans nearly the
 * whole longitude range. This mirrors the caveat on the centroid helper.
 *
 * @param {Object} geometry a GeoJSON geometry (e.g. Polygon or MultiPolygon)
 * @param {number} [decimals=5] number of decimal places to round each value to
 * @return {number[]|null} [minLng, minLat, maxLng, maxLat], or null if empty
 */
function geometryBbox (geometry, decimals = 5) {
  let minLng = Infinity
  let minLat = Infinity
  let maxLng = -Infinity
  let maxLat = -Infinity

  const visit = coords => {
    if (typeof coords[0] === 'number') {
      const lng = coords[0]
      const lat = coords[1]
      if (lng < minLng) minLng = lng
      if (lat < minLat) minLat = lat
      if (lng > maxLng) maxLng = lng
      if (lat > maxLat) maxLat = lat
    } else {
      coords.forEach(visit)
    }
  }
  visit(geometry.coordinates)

  if (!Number.isFinite(minLng)) {
    return null
  }
  const factor = Math.pow(10, decimals)
  const round = value => Math.round(value * factor) / factor
  return [round(minLng), round(minLat), round(maxLng), round(maxLat)]
}

module.exports = geometryBbox
