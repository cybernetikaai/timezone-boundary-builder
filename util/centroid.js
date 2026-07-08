const jsts = require('jsts')

const geoJsonReader = new jsts.io.GeoJSONReader()

/**
 * Compute the area-weighted geographic centroid (center of mass) of a GeoJSON
 * geometry, returned as a rounded [lng, lat] coordinate pair (GeoJSON order).
 *
 * The centroid is computed in planar lng/lat space. For concave, multi-part or
 * antimeridian-crossing geometries the point is a reasonable representative but
 * is not guaranteed to fall inside the geometry.
 *
 * @param {Object} geometry a GeoJSON geometry (e.g. Polygon or MultiPolygon)
 * @param {number} [decimals=5] number of decimal places to round each coordinate to
 * @return {number[]|null} [lng, lat], or null if a centroid cannot be computed
 */
function geometryCentroid (geometry, decimals = 5) {
  const centroid = geoJsonReader.read(JSON.stringify(geometry)).getCentroid()
  if (centroid.isEmpty()) {
    return null
  }
  const factor = Math.pow(10, decimals)
  const round = value => Math.round(value * factor) / factor
  return [round(centroid.getX()), round(centroid.getY())]
}

module.exports = geometryCentroid
