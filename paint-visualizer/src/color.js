/* PaintViz — color math
 * sRGB <-> linear light, OKLab (for perceptual masking distance), hex parsing.
 * Everything the recolor engine does happens in LINEAR light, because that is
 * where "surface reflectance x illumination" is actually a multiplication.
 * Doing it in gamma space is the #1 reason cheap visualizers look like stickers.
 */
(function (global) {
  'use strict';
  var PaintViz = (global.PaintViz = global.PaintViz || {});
  var C = (PaintViz.color = {});

  /* ---------- sRGB transfer functions (LUT-backed) ---------- */

  var S2L = new Float32Array(256);
  for (var i = 0; i < 256; i++) {
    var c = i / 255;
    S2L[i] = c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  }
  C.S2L = S2L;

  var L2S_N = 4096;
  var L2S = new Uint8Array(L2S_N + 1);
  for (var j = 0; j <= L2S_N; j++) {
    var v = j / L2S_N;
    var s = v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - 0.055;
    L2S[j] = Math.max(0, Math.min(255, Math.round(s * 255)));
  }
  C.linToByte = function (v) {
    if (!(v > 0)) return 0;
    if (v >= 1) return 255;
    return L2S[(v * L2S_N) | 0];
  };

  C.LUM_R = 0.2126;
  C.LUM_G = 0.7152;
  C.LUM_B = 0.0722;
  C.lum = function (r, g, b) { return 0.2126 * r + 0.7152 * g + 0.0722 * b; };

  /* ---------- hex ---------- */

  C.parseHex = function (hex) {
    if (!hex) return null;
    var h = String(hex).trim().replace(/^#/, '');
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    if (!/^[0-9a-fA-F]{6}$/.test(h)) return null;
    var n = parseInt(h, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  };

  C.toHex = function (rgb) {
    function p(v) { var s = Math.max(0, Math.min(255, Math.round(v))).toString(16); return s.length < 2 ? '0' + s : s; }
    return '#' + p(rgb[0]) + p(rgb[1]) + p(rgb[2]);
  };

  /** hex -> [r,g,b] in linear light, 0..1 */
  C.hexToLinear = function (hex) {
    var rgb = C.parseHex(hex) || [128, 128, 128];
    return [S2L[rgb[0]], S2L[rgb[1]], S2L[rgb[2]]];
  };

  /* ---------- HSL (for palette sorting / custom picker) ---------- */

  C.rgbToHsl = function (r, g, b) {
    r /= 255; g /= 255; b /= 255;
    var max = Math.max(r, g, b), min = Math.min(r, g, b);
    var h = 0, s = 0, l = (max + min) / 2, d = max - min;
    if (d > 1e-6) {
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      if (max === r) h = ((g - b) / d + (g < b ? 6 : 0));
      else if (max === g) h = (b - r) / d + 2;
      else h = (r - g) / d + 4;
      h *= 60;
    }
    return [h, s, l];
  };

  C.hslToRgb = function (h, s, l) {
    h = ((h % 360) + 360) % 360;
    var c = (1 - Math.abs(2 * l - 1)) * s;
    var x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    var m = l - c / 2, r = 0, g = 0, b = 0;
    if (h < 60) { r = c; g = x; }
    else if (h < 120) { r = x; g = c; }
    else if (h < 180) { g = c; b = x; }
    else if (h < 240) { g = x; b = c; }
    else if (h < 300) { r = x; b = c; }
    else { r = c; b = x; }
    return [(r + m) * 255, (g + m) * 255, (b + m) * 255];
  };

  /* ---------- Light Reflectance Value ----------
   * LRV is the number painters actually quote off a fan deck: the percentage of
   * visible light a color reflects. It is (near enough) 100 x relative luminance.
   */
  C.lrv = function (hex) {
    var rgb = C.parseHex(hex) || [128, 128, 128];
    return Math.round(C.lum(S2L[rgb[0]], S2L[rgb[1]], S2L[rgb[2]]) * 1000) / 10;
  };

  /** Readable ink color for a swatch chip. */
  C.inkOn = function (hex) { return C.lrv(hex) > 42 ? '#141413' : '#ffffff'; };

  /* ---------- OKLab ----------
   * Used for magic-wand tolerance: perceptually uniform, so one tolerance value
   * behaves the same on a pale wall and a dark roof.
   */
  C.linearToOklab = function (r, g, b, out) {
    var l = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b;
    var m = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b;
    var s = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b;
    var l_ = Math.cbrt(l), m_ = Math.cbrt(m), s_ = Math.cbrt(s);
    out[0] = 0.2104542553 * l_ + 0.7936177850 * m_ - 0.0040720468 * s_;
    out[1] = 1.9779984951 * l_ - 2.4285922050 * m_ + 0.4505937099 * s_;
    out[2] = 0.0259040371 * l_ + 0.7827717662 * m_ - 0.8086757660 * s_;
    return out;
  };

  C.hexToOklab = function (hex) {
    var rgb = C.parseHex(hex) || [128, 128, 128];
    return C.linearToOklab(S2L[rgb[0]], S2L[rgb[1]], S2L[rgb[2]], [0, 0, 0]);
  };

  /** Perceptual distance between two hexes — used for "closest match" lookups. */
  C.deltaE = function (hexA, hexB) {
    var a = C.hexToOklab(hexA), b = C.hexToOklab(hexB);
    var dl = a[0] - b[0], da = a[1] - b[1], db = a[2] - b[2];
    return Math.sqrt(dl * dl + da * da + db * db);
  };
})(typeof window !== 'undefined' ? window : this);
