// satellite.js's package entry also re-exports an optional WebAssembly build whose
// worker the bundler can't package (and this app never uses). Import only the plain
// JavaScript modules it is built from.
export { json2satrec, twoline2satrec } from "../../node_modules/satellite.js/dist/io.js";
export { gstime, propagate } from "../../node_modules/satellite.js/dist/propagation.js";
export {
  degreesLat,
  degreesLong,
  degreesToRadians,
  ecfToLookAngles,
  eciToEcf,
  eciToGeodetic,
} from "../../node_modules/satellite.js/dist/transforms.js";
export { sunPos } from "../../node_modules/satellite.js/dist/sun.js";
export { shadowFraction } from "../../node_modules/satellite.js/dist/shadow.js";
export { jday } from "../../node_modules/satellite.js/dist/ext.js";
export type { OMMJsonObject } from "../../node_modules/satellite.js/dist/common-types.js";
export type { SatRec } from "../../node_modules/satellite.js/dist/propagation/SatRec.js";
