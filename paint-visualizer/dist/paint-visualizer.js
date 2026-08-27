/* PaintViz — color visualizer. Built 2026-08-27T04:51:28Z. */

/* ===== src/color.js ===== */
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

/* ===== src/palette.js ===== */
/* PaintViz — default palette and designer schemes
 *
 * These are ORIGINAL colors with original names, deliberately not any paint
 * manufacturer's fan deck. Brand color names and their code numbers are
 * trademarks, and the curated collections themselves are licensed products —
 * shipping "SW 7008 Alabaster" on a public site is a legal question, not a
 * technical one. Each entry carries a `code` and an empty `brand` field so you
 * can map your own supplier's numbers in once you have the rights to use them:
 *
 *     { name: 'Quarry Mist', hex: '#c9cbc6', code: 'PV-312', brand: 'XX 7015' }
 *
 * Swap this whole file out by passing `palette:` to PaintViz.mount().
 */
(function (global) {
  'use strict';
  var PaintViz = (global.PaintViz = global.PaintViz || {});

  function c(name, hex, code) { return { name: name, hex: hex, code: code, brand: '' }; }

  PaintViz.palette = {
    collections: [
      { id: 'whites', name: 'Whites & Off-Whites', colors: [
        c('Gallery White', '#ffffff', 'PV-101'), c('Cotton Field', '#f8f6f1', 'PV-102'),
        c('Warm Chalk', '#f4f0e6', 'PV-103'), c('Soft Linen', '#efe9dc', 'PV-104'),
        c('Bone China', '#eae4d6', 'PV-105'), c('Cool Plaster', '#f1f2f0', 'PV-106'),
        c('Morning Frost', '#e9ecec', 'PV-107'), c('Antique Paper', '#e6dfcd', 'PV-108'),
        c('Sail Cloth', '#f2eee7', 'PV-109'), c('Buttermilk', '#f3ecd9', 'PV-110'),
        c('Shell', '#ece6dd', 'PV-111'), c('Studio White', '#f6f6f4', 'PV-112')
      ] },
      { id: 'neutrals', name: 'Warm Neutrals & Greige', colors: [
        c('Raw Canvas', '#ddd5c6', 'PV-201'), c('Field Stone', '#cfc7b8', 'PV-202'),
        c('Driftwood', '#bfb6a6', 'PV-203'), c('Wheat Straw', '#d6c9ae', 'PV-204'),
        c('Mushroom', '#b3a898', 'PV-205'), c('Taupe Ridge', '#a3968a', 'PV-206'),
        c('Wet Sand', '#c8bba6', 'PV-207'), c('Hemp Rope', '#b9ab93', 'PV-208'),
        c('Clay Dust', '#c4b3a2', 'PV-209'), c('Weathered Oak', '#9d9184', 'PV-210'),
        c('Pale Almond', '#e0d6c4', 'PV-211'), c('Stone Path', '#aaa296', 'PV-212')
      ] },
      { id: 'grays', name: 'Cool Grays', colors: [
        c('Quarry Mist', '#d3d6d4', 'PV-301'), c('Harbor Fog', '#c2c8c9', 'PV-302'),
        c('Slate Wash', '#aeb6b8', 'PV-303'), c('Pewter', '#98a0a3', 'PV-304'),
        c('Storm Cloud', '#7f888c', 'PV-305'), c('Graphite', '#666e72', 'PV-306'),
        c('Iron Gate', '#545c60', 'PV-307'), c('Anchor Gray', '#454c50', 'PV-308'),
        c('Silver Birch', '#dcdedd', 'PV-309'), c('Zinc', '#8d9295', 'PV-310'),
        c('Flint', '#6f7477', 'PV-311'), c('Charcoal Slate', '#3a3f42', 'PV-312')
      ] },
      { id: 'blues', name: 'Blues', colors: [
        c('Sea Glass', '#cbd9d9', 'PV-401'), c('Morning Sky', '#b3c6d4', 'PV-402'),
        c('Chambray', '#8fa8bd', 'PV-403'), c('Harbor Blue', '#6d8aa3', 'PV-404'),
        c('Denim', '#556f89', 'PV-405'), c('Slate Blue', '#455a72', 'PV-406'),
        c('Deep Harbor', '#33475c', 'PV-407'), c('Naval Navy', '#233246', 'PV-408'),
        c('Midnight Hull', '#1b2634', 'PV-409'), c('Coastal Teal', '#5c8288', 'PV-410'),
        c('Bluestone', '#7d95a6', 'PV-411'), c('Ink Well', '#28334a', 'PV-412')
      ] },
      { id: 'greens', name: 'Greens', colors: [
        c('Sea Salt Green', '#d4dcd2', 'PV-501'), c('Sage Wash', '#bcc7b4', 'PV-502'),
        c('Dried Sage', '#a3b09a', 'PV-503'), c('Olive Grove', '#8b9678', 'PV-504'),
        c('Fern', '#6f7f63', 'PV-505'), c('Hunter Green', '#495c48', 'PV-506'),
        c('Forest Deep', '#36452f', 'PV-507'), c('Juniper', '#5b6b60', 'PV-508'),
        c('Eucalyptus', '#9aa89c', 'PV-509'), c('Moss Stone', '#7d8a72', 'PV-510'),
        c('Pine Shadow', '#2f3b33', 'PV-511'), c('Celadon', '#c6d3c3', 'PV-512')
      ] },
      { id: 'earth', name: 'Earth & Clay', colors: [
        c('Terracotta', '#b16a4e', 'PV-601'), c('Rust Barn', '#8f4a35', 'PV-602'),
        c('Cinnamon', '#9c6647', 'PV-603'), c('Saddle Brown', '#7a5340', 'PV-604'),
        c('Cedar', '#8c5a3c', 'PV-605'), c('Adobe', '#c48d6a', 'PV-606'),
        c('Espresso', '#4a3a30', 'PV-607'), c('Chestnut', '#5f4334', 'PV-608'),
        c('Ochre', '#c39a5b', 'PV-609'), c('Brick Red', '#8e4b45', 'PV-610'),
        c('Umber', '#6b5844', 'PV-611'), c('Copper Kettle', '#a4653e', 'PV-612')
      ] },
      { id: 'deep', name: 'Deep & Dramatic', colors: [
        c('Onyx', '#222424', 'PV-701'), c('Soft Black', '#2b2b29', 'PV-702'),
        c('Bear Black', '#31332f', 'PV-703'), c('Cocoa Black', '#332c27', 'PV-704'),
        c('Aubergine', '#3d3038', 'PV-705'), c('Black Olive', '#333429', 'PV-706'),
        c('Gunmetal', '#3c4145', 'PV-707'), c('Peppercorn', '#4a4744', 'PV-708')
      ] },
      { id: 'accent', name: 'Front Door & Accent', colors: [
        c('Lacquer Red', '#9c2f2a', 'PV-801'), c('Chinese Yellow', '#d9a441', 'PV-802'),
        c('Turquoise Door', '#3f8e91', 'PV-803'), c('Plum', '#5c3648', 'PV-804'),
        c('Kelly Green', '#3f6b45', 'PV-805'), c('Coral', '#c9705c', 'PV-806'),
        c('Robin Egg', '#7fb0b5', 'PV-807'), c('Mustard', '#b8863a', 'PV-808'),
        c('Wine', '#6b2f38', 'PV-809'), c('Peacock', '#2c5f6b', 'PV-810')
      ] }
    ],

    /* Designer schemes — one tap applies a whole coordinated combination.
     * Keys are region ROLES, so a scheme works on any scene whose regions are
     * tagged, regardless of how many surfaces that particular photo has. */
    schemes: [
      { id: 'coastal', name: 'Coastal Classic', for: 'exterior',
        roles: { body: '#b3c6d4', trim: '#ffffff', accent: '#233246', shutter: '#233246', garage: '#ffffff', masonry: '#c2c8c9' } },
      { id: 'farmhouse', name: 'Modern Farmhouse', for: 'exterior',
        roles: { body: '#f4f0e6', trim: '#f8f6f1', accent: '#2b2b29', shutter: '#2b2b29', garage: '#f8f6f1', masonry: '#aaa296' } },
      { id: 'charcoal-cedar', name: 'Charcoal & Cedar', for: 'exterior',
        roles: { body: '#3a3f42', trim: '#efe9dc', accent: '#a4653e', shutter: '#2b2b29', garage: '#efe9dc', masonry: '#666e72' } },
      { id: 'sage-stone', name: 'Sage & Stone', for: 'exterior',
        roles: { body: '#a3b09a', trim: '#f2eee7', accent: '#36452f', shutter: '#495c48', garage: '#f2eee7', masonry: '#b3a898' } },
      { id: 'greige-classic', name: 'Warm Greige', for: 'exterior',
        roles: { body: '#cfc7b8', trim: '#f8f6f1', accent: '#6b2f38', shutter: '#7a5340', garage: '#f8f6f1', masonry: '#a3968a' } },
      { id: 'navy-white', name: 'Navy & White', for: 'exterior',
        roles: { body: '#33475c', trim: '#ffffff', accent: '#d9a441', shutter: '#233246', garage: '#ffffff', masonry: '#98a0a3' } },

      { id: 'two-tone-kitchen', name: 'Two-Tone Kitchen', for: 'interior',
        roles: { cabinetUpper: '#f4f0e6', cabinetLower: '#455a72', island: '#455a72', wall: '#e9ecec', trim: '#ffffff', masonry: '#f8f6f1', body: '#455a72' } },
      { id: 'warm-white-kitchen', name: 'All Warm White', for: 'interior',
        roles: { cabinetUpper: '#f4f0e6', cabinetLower: '#efe9dc', island: '#b3a898', wall: '#e0d6c4', trim: '#ffffff', masonry: '#f8f6f1', body: '#efe9dc' } },
      { id: 'sage-kitchen', name: 'Sage & Cream', for: 'interior',
        roles: { cabinetUpper: '#f8f6f1', cabinetLower: '#8b9678', island: '#8b9678', wall: '#efe9dc', trim: '#ffffff', masonry: '#f2eee7', body: '#8b9678' } },
      { id: 'moody-kitchen', name: 'Moody Modern', for: 'interior',
        roles: { cabinetUpper: '#31332f', cabinetLower: '#31332f', island: '#a4653e', wall: '#c2c8c9', trim: '#f1f2f0', masonry: '#f8f6f1', body: '#31332f' } },
      { id: 'greige-kitchen', name: 'Soft Greige', for: 'interior',
        roles: { cabinetUpper: '#efe9dc', cabinetLower: '#a3968a', island: '#545c60', wall: '#ddd5c6', trim: '#f8f6f1', masonry: '#f2eee7', body: '#a3968a' } }
    ]
  };

  /** Flat lookup of every color, for search and nearest-match. */
  PaintViz.paletteIndex = function (pal) {
    var all = [];
    (pal || PaintViz.palette).collections.forEach(function (col) {
      col.colors.forEach(function (x) {
        all.push({ name: x.name, hex: x.hex, code: x.code, brand: x.brand, collection: col.name });
      });
    });
    return all;
  };

  /** Nearest palette entry to an arbitrary hex — used to name custom picks. */
  PaintViz.nearestColor = function (hex, pal) {
    var all = PaintViz.paletteIndex(pal), best = null, bd = 1e9;
    for (var i = 0; i < all.length; i++) {
      var d = PaintViz.color.deltaE(hex, all[i].hex);
      if (d < bd) { bd = d; best = all[i]; }
    }
    return best ? { color: best, distance: bd } : null;
  };
})(typeof window !== 'undefined' ? window : this);

/* ===== src/engine.js ===== */
/* PaintViz — recolor engine
 * ============================================================================
 * THE MODEL
 *
 * A photograph of a painted surface is, near enough:
 *
 *     observed = albedo (the paint) x irradiance (the light landing on it)
 *
 * A cheap visualizer overlays a translucent color, which multiplies the whole
 * thing again and leaves the OLD color dragging through — that is why light
 * paint over dark siding looks impossible and everything looks like a decal.
 *
 * We instead DIVIDE the old paint back out. Within one masked region we assume
 * a single albedo (true — it is one coat of one color), estimate it from the
 * region's own statistics, and recover the irradiance field E:
 *
 *     E = observed / albedo_est
 *
 * E is the real light in the real photo: sun falloff, eave shadows, ambient
 * occlusion in corners, the texture shadowing of every lap-siding board, the
 * grain of a cabinet door. Then we re-render with the new paint:
 *
 *     result = new_paint x E
 *
 * Because E carries all the shading and texture, the new color lands on the
 * house instead of on top of it. And because a paint's albedo can be brighter
 * OR darker than the old one, this handles white-over-navy just as correctly as
 * navy-over-white — which a multiply blend fundamentally cannot.
 *
 * Three refinements make it read as photographic rather than merely correct:
 *
 * 1. NORMALIZATION. E is scaled so the region's 88th-percentile luminance maps
 *    to 1.0. That means "the well-lit part of this wall renders at exactly the
 *    color on the chip" — the convention a customer judges against when they
 *    hold a swatch up to the house. Shade falls below, glare rises above.
 *
 * 2. SPECULAR SPLIT. Above a soft knee, luminance is treated as reflected
 *    highlight rather than diffuse shading, and added back as achromatic light
 *    instead of being multiplied by the paint. Window glare and the wet sheen
 *    on a gloss door stay white instead of turning navy. The knee's gain is
 *    driven by the chosen sheen, so semi-gloss trim really does read glossier
 *    than flat siding.
 *
 * 3. LIGHT CAST. E is computed per channel, so the warm sun / cool skylight
 *    split in the original photo survives. Blended toward neutral by
 *    `lightCast` so the old hue does not contaminate the new one.
 * ============================================================================
 */
(function (global) {
  'use strict';
  var PaintViz = (global.PaintViz = global.PaintViz || {});
  var C = PaintViz.color;

  /* Sheen -> specular gain. Flat scatters highlights; gloss returns them. */
  var SHEENS = {
    flat:         { label: 'Flat / Matte', spec: 0.35, knee: 1.55, soft: 0.60, gamma: 0.93 },
    eggshell:     { label: 'Eggshell',     spec: 0.55, knee: 1.45, soft: 0.52, gamma: 1.00 },
    satin:        { label: 'Satin',        spec: 0.72, knee: 1.35, soft: 0.45, gamma: 1.06 },
    'semi-gloss': { label: 'Semi-Gloss',   spec: 0.95, knee: 1.20, soft: 0.36, gamma: 1.14 },
    gloss:        { label: 'High Gloss',   spec: 1.25, knee: 1.05, soft: 0.28, gamma: 1.24 }
  };

  PaintViz.SHEENS = SHEENS;

  /* ---------------------------------------------------------------- Surface */

  /**
   * Precompute the irradiance field for one masked region.
   * This is the expensive step and it runs ONCE per region per photo. After it,
   * changing color is a cheap multiply, so the palette feels instant.
   *
   * @param {Uint8ClampedArray} px  RGBA source pixels
   * @param {Uint8Array} mask       coverage 0..255, length w*h
   */
  function Surface(id, px, mask, w, h, opts) {
    opts = opts || {};
    this.id = id;
    this.name = opts.name || id;
    this.sheen = opts.sheen || 'satin';
    this.opacity = opts.opacity == null ? 1 : opts.opacity;   // <1 = stain/glaze
    this.lightCast = opts.lightCast == null ? 0.35 : opts.lightCast;
    this.color = opts.color || null;
    this.enabled = true;

    var np = w * h, i, k, n = 0;
    for (i = 0; i < np; i++) if (mask[i] > 0) n++;
    this.count = n;

    var idx = (this.idx = new Int32Array(n));
    var alpha = (this.alpha = new Float32Array(n));
    k = 0;
    for (i = 0; i < np; i++) {
      if (mask[i] > 0) { idx[k] = i; alpha[k] = mask[i] / 255; k++; }
    }

    // Cache the region's linear source pixels (needed for glaze blending).
    var lr = (this.lr = new Float32Array(n));
    var lg = (this.lg = new Float32Array(n));
    var lb = (this.lb = new Float32Array(n));
    var ly = new Float32Array(n);

    var S2L = C.S2L, HB = 1024, hist = new Uint32Array(HB), solid = 0;
    for (k = 0; k < n; k++) {
      var p = idx[k] << 2;
      var r = S2L[px[p]], g = S2L[px[p + 1]], b = S2L[px[p + 2]];
      lr[k] = r; lg[k] = g; lb[k] = b;
      var y = C.lum(r, g, b); ly[k] = y;
      if (alpha[k] > 0.75) {
        // sqrt-companded histogram: more resolution where shadow detail lives
        var bin = (Math.sqrt(y) * (HB - 1)) | 0;
        hist[bin < 0 ? 0 : bin > HB - 1 ? HB - 1 : bin]++;
        solid++;
      }
    }
    if (!solid) { solid = 1; hist[HB >> 1] = 1; }

    function pct(q) {
      var want = q * solid, acc = 0;
      for (var b2 = 0; b2 < HB; b2++) {
        acc += hist[b2];
        if (acc >= want) { var t = b2 / (HB - 1); return t * t; }
      }
      return 1;
    }

    // Two-pass reference. p98 marks where blown/specular pixels begin; the
    // diffuse reference is then the 95th percentile of what remains, i.e. the
    // best-lit genuinely-diffuse part of the surface.
    var yHi = Math.max(pct(0.98), 0.004);
    var yRef = Math.max(pct(0.95 * 0.98), 0.0035);

    // Mean chromaticity of the DIFFUSE pixels only. Glare would bias it white.
    var mr = 0, mg = 0, mb = 0, mn = 0;
    for (k = 0; k < n; k++) {
      if (alpha[k] > 0.75 && ly[k] <= yHi) { mr += lr[k]; mg += lg[k]; mb += lb[k]; mn++; }
    }
    if (!mn) { mr = mg = mb = 0.18; mn = 1; }
    mr /= mn; mg /= mn; mb /= mn;
    var yMean = Math.max(C.lum(mr, mg, mb), 1e-5);

    // gain[c] divides out both the old paint's value and its hue, then rescales
    // so a well-lit pixel sits at E = 1.
    var gr = yMean / (Math.max(mr, 1e-5) * yRef);
    var gg = yMean / (Math.max(mg, 1e-5) * yRef);
    var gb = yMean / (Math.max(mb, 1e-5) * yRef);

    var er = (this.er = new Float32Array(n));
    var eg = (this.eg = new Float32Array(n));
    var eb = (this.eb = new Float32Array(n));
    var ye = (this.ye = new Float32Array(n));
    for (k = 0; k < n; k++) {
      var a = lr[k] * gr, b2v = lg[k] * gg, c2 = lb[k] * gb;
      er[k] = a; eg[k] = b2v; eb[k] = c2;
      ye[k] = C.lum(a, b2v, c2);
    }

    this.stats = {
      yRef: yRef,
      originalHex: C.toHex([
        C.linToByte(mr / yMean * yRef), C.linToByte(mg / yMean * yRef), C.linToByte(mb / yMean * yRef)
      ]),
      pixels: n
    };
  }

  /** Paint this surface into a linear float accumulator addressed by slot map. */
  Surface.prototype.composite = function (accum, slotOf) {
    if (!this.enabled || !this.color) return;
    var P = C.hexToLinear(this.color);
    var pr = P[0], pg = P[1], pb = P[2];
    var sh = SHEENS[this.sheen] || SHEENS.satin;
    var knee = sh.knee, soft = sh.soft, specGain = sh.spec, gam = sh.gamma;
    var cast = this.lightCast, op = this.opacity;
    var idx = this.idx, alpha = this.alpha, n = this.count;
    var er = this.er, eg = this.eg, eb = this.eb, ye = this.ye;
    var lr = this.lr, lg = this.lg, lb = this.lb;

    for (var k = 0; k < n; k++) {
      var y = ye[k];

      // Sheen shapes how directionally the finish returns light: a flat finish
      // scatters and softens the shading, a gloss deepens it. E = 1 is a fixed
      // point, so this never breaks the "lit wall == the chip" guarantee.
      if (gam !== 1) { var yg = Math.pow(y, gam); var gs = y > 1e-6 ? yg / y : 1; y = yg; } else { gs = 1; }

      // Soft-knee compressor: diffuse portion of the irradiance.
      var yd = y <= knee ? y : knee + soft * (1 - Math.exp((knee - y) / soft));
      var scale = y > 1e-6 ? yd / y : 1;

      // Per-channel diffuse light, pulled toward neutral by (1 - lightCast) so
      // the previous color's hue does not survive the repaint.
      scale *= gs;
      var dr = yd + (er[k] * scale - yd) * cast;
      var dg = yd + (eg[k] * scale - yd) * cast;
      var db = yd + (eb[k] * scale - yd) * cast;

      // Everything above the knee is reflected highlight: achromatic, not tinted.
      var sp = (y - yd) * specGain;

      var or_ = pr * dr + sp, og = pg * dg + sp, ob = pb * db + sp;

      if (op < 1) { // glaze / stain: let the substrate read through
        or_ = lr[k] + (or_ - lr[k]) * op;
        og = lg[k] + (og - lg[k]) * op;
        ob = lb[k] + (ob - lb[k]) * op;
      }

      var slot = slotOf[idx[k]] * 3, a = alpha[k], ia = 1 - a;
      accum[slot] = accum[slot] * ia + or_ * a;
      accum[slot + 1] = accum[slot + 1] * ia + og * a;
      accum[slot + 2] = accum[slot + 2] * ia + ob * a;
    }
  };

  /* ------------------------------------------------------------- Compositor */

  /**
   * Holds the source photo plus its surfaces and renders to a canvas.
   * Only pixels covered by at least one mask are ever touched, so a render is
   * proportional to painted area, not image area.
   */
  function Compositor(imageData) {
    this.w = imageData.width;
    this.h = imageData.height;
    this.base = imageData;
    this.out = new ImageData(new Uint8ClampedArray(imageData.data), this.w, this.h);
    this.surfaces = [];
    this.slotOf = null;
    this.union = null;
    this.unionBase = null;
    this.accum = null;
  }

  Compositor.prototype.addSurface = function (surface) {
    this.surfaces.push(surface);
    this._dirty = true;
    return surface;
  };

  Compositor.prototype.removeSurface = function (id) {
    this.surfaces = this.surfaces.filter(function (s) { return s.id !== id; });
    this._dirty = true;
  };

  Compositor.prototype.get = function (id) {
    for (var i = 0; i < this.surfaces.length; i++) if (this.surfaces[i].id === id) return this.surfaces[i];
    return null;
  };

  /** Which surface owns a given pixel — powers hover and click-to-select. O(1). */
  Compositor.prototype.surfaceAt = function (x, y) {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return null;
    if (this._dirty || !this.idMap) this._rebuild();
    var i = this.idMap[(y | 0) * this.w + (x | 0)];
    return i < 0 ? null : this.surfaces[i];
  };

  /**
   * Outline of one surface, as a transparent canvas ready to overlay.
   * Traces the mask boundary rather than filling it, so hovering a surface shows
   * exactly what would be repainted without hiding the photo underneath.
   */
  Compositor.prototype.outline = function (surfaceOrId, cssColor) {
    var s = typeof surfaceOrId === 'string' ? this.get(surfaceOrId) : surfaceOrId;
    if (!s) return null;
    if (this._dirty || !this.idMap) this._rebuild();
    var w = this.w, h = this.h, idMap = this.idMap;
    var si = this.surfaces.indexOf(s);
    if (s._outline && s._outlineColor === cssColor) return s._outline;

    var cv = document.createElement('canvas');
    cv.width = w; cv.height = h;
    var img = new ImageData(w, h), d = img.data;
    var rgb = C.parseHex(cssColor) || [255, 255, 255];
    for (var k = 0; k < s.count; k++) {
      var pi = s.idx[k];
      if (idMap[pi] !== si) continue;
      var x = pi % w, y = (pi / w) | 0;
      var edge =
        (x === 0 || idMap[pi - 1] !== si) || (x === w - 1 || idMap[pi + 1] !== si) ||
        (y === 0 || idMap[pi - w] !== si) || (y === h - 1 || idMap[pi + w] !== si);
      if (!edge) continue;
      var p = pi << 2;
      d[p] = rgb[0]; d[p + 1] = rgb[1]; d[p + 2] = rgb[2]; d[p + 3] = 255;
    }
    cv.getContext('2d').putImageData(img, 0, 0);
    s._outline = cv; s._outlineColor = cssColor;
    return cv;
  };

  Compositor.prototype._rebuild = function () {
    var np = this.w * this.h;
    var slotOf = new Int32Array(np).fill(-1);
    var idMap = new Int16Array(np).fill(-1);
    var ownerA = new Float32Array(np);
    var i, k, s, n = 0;
    for (i = 0; i < this.surfaces.length; i++) {
      s = this.surfaces[i];
      s._outline = null;
      for (k = 0; k < s.count; k++) {
        var pi = s.idx[k];
        if (slotOf[pi] === -1) slotOf[pi] = n++;
        // where masks overlap, the pixel belongs to whichever covers it more
        if (s.alpha[k] > ownerA[pi] && s.alpha[k] > 0.25) { ownerA[pi] = s.alpha[k]; idMap[pi] = i; }
      }
    }
    this.idMap = idMap;
    var union = new Int32Array(n);
    for (i = 0; i < np; i++) if (slotOf[i] >= 0) union[slotOf[i]] = i;

    var unionBase = new Float32Array(n * 3), d = this.base.data, S2L = C.S2L;
    for (k = 0; k < n; k++) {
      var p = union[k] << 2;
      unionBase[k * 3] = S2L[d[p]];
      unionBase[k * 3 + 1] = S2L[d[p + 1]];
      unionBase[k * 3 + 2] = S2L[d[p + 2]];
    }
    this.slotOf = slotOf; this.union = union;
    this.unionBase = unionBase; this.accum = new Float32Array(n * 3);
    this._dirty = false;
  };

  Compositor.prototype.render = function () {
    if (this._dirty || !this.slotOf) this._rebuild();
    var accum = this.accum;
    accum.set(this.unionBase);                    // reset painted area to the photo
    for (var i = 0; i < this.surfaces.length; i++) {
      this.surfaces[i].composite(accum, this.slotOf);
    }
    var union = this.union, out = this.out.data, n = union.length, l2b = C.linToByte;
    for (var k = 0; k < n; k++) {
      var p = union[k] << 2, q = k * 3;
      out[p] = l2b(accum[q]);
      out[p + 1] = l2b(accum[q + 1]);
      out[p + 2] = l2b(accum[q + 2]);
    }
    return this.out;
  };

  Compositor.prototype.drawTo = function (ctx) {
    ctx.putImageData(this.render(), 0, 0);
  };

  PaintViz.Surface = Surface;
  PaintViz.Compositor = Compositor;
})(typeof window !== 'undefined' ? window : this);

/* ===== src/mask.js ===== */
/* PaintViz — mask authoring
 * Magic wand, brush, feather and morphology, plus PNG (de)serialization.
 *
 * The wand measures distance in OKLab with luminance DOWN-WEIGHTED. That is the
 * detail that makes it usable on houses: one wall runs from full sun to deep
 * shade, so its lightness varies enormously while its hue barely moves. A wand
 * that weights lightness equally stops at the shadow line every time.
 */
(function (global) {
  'use strict';
  var PaintViz = (global.PaintViz = global.PaintViz || {});
  var C = PaintViz.color;
  var M = (PaintViz.mask = {});

  /**
   * Per-image OKLab cache plus an edge map.
   *
   * Two representations, deliberately: the BLURRED channels are what the seed
   * comparison uses, so sensor noise and JPEG blocking don't fragment the fill.
   * The edge map G is computed from the UNBLURRED pixels, because blurring turns
   * the hard step at a trim board into a three-pixel ramp that a fill will
   * happily walk across one small step at a time.
   */
  M.analyze = function (data, w, h) {
    var n = w * h;
    var L = new Float32Array(n), A = new Float32Array(n), B = new Float32Array(n);
    var S2L = C.S2L, tmp = [0, 0, 0];
    for (var i = 0; i < n; i++) {
      var p = i << 2;
      C.linearToOklab(S2L[data[p]], S2L[data[p + 1]], S2L[data[p + 2]], tmp);
      L[i] = tmp[0]; A[i] = tmp[1]; B[i] = tmp[2];
    }
    var G = new Float32Array(n), CW = 1.6; // chroma edges count for more than value
    for (var y = 0; y < h; y++) {
      for (var x = 0; x < w; x++) {
        var i2 = y * w + x;
        var rx = x < w - 1 ? i2 + 1 : i2, dy2 = y < h - 1 ? i2 + w : i2;
        var dl = L[rx] - L[i2], da = (A[rx] - A[i2]) * CW, db = (B[rx] - B[i2]) * CW;
        var gx = dl * dl + da * da + db * db;
        dl = L[dy2] - L[i2]; da = (A[dy2] - A[i2]) * CW; db = (B[dy2] - B[i2]) * CW;
        var gy = dl * dl + da * da + db * db;
        G[i2] = Math.sqrt(gx > gy ? gx : gy);
      }
    }
    return { L: blur3(L, w, h), A: blur3(A, w, h), B: blur3(B, w, h), G: G, w: w, h: h };
  };

  function blur3(src, w, h) {
    var t = new Float32Array(src.length), o = new Float32Array(src.length), x, y, i;
    for (y = 0; y < h; y++) for (x = 0; x < w; x++) {
      i = y * w + x;
      t[i] = (src[i - (x > 0 ? 1 : 0)] + src[i] + src[i + (x < w - 1 ? 1 : 0)]) / 3;
    }
    for (y = 0; y < h; y++) for (x = 0; x < w; x++) {
      i = y * w + x;
      o[i] = (t[i - (y > 0 ? w : 0)] + t[i] + t[i + (y < h - 1 ? w : 0)]) / 3;
    }
    return o;
  }

  /* Tunables. Defaults were fitted against ground-truth masks on both demo
   * scenes; see README "Tuning the wand" before changing them. */
  M.LUM_WEIGHT = 0.32;   // < 1 so sun-to-shade shading does not read as a new color
  M.EDGE_BASE = 0.020;   // weakest edge the fill will refuse to cross
  M.EDGE_SLOPE = 0.14;   // how much the tolerance slider loosens that

  /**
   * Dual-threshold flood fill.
   *
   * A single tolerance cannot do this job. Compare only against the seed and you
   * must open the tolerance wide enough to cross a wall's sun-to-shade gradient
   * — by which point it also swallows the trim. So we run two tests:
   *
   *   EDGE   — the fill refuses to cross a pixel whose unblurred gradient is
   *            strong. Smooth shading passes; the step edge at a trim board,
   *            roofline or window casing does not.
   *   GLOBAL — versus the original seed, with luminance down-weighted. Lets the
   *            selection drift across a whole shaded facade while still refusing
   *            to wander off onto something a different color.
   *
   * @param {object} an       result of M.analyze
   * @param {number} tol      0..100 from the UI slider
   * @param {boolean} contiguous  false = pick every similar pixel in the photo
   * @returns {Uint8Array} hard-edged mask (feather separately)
   */
  M.wand = function (an, sx, sy, tol, contiguous) {
    var w = an.w, h = an.h, L = an.L, A = an.A, B = an.B, G = an.G;
    sx = Math.max(0, Math.min(w - 1, sx | 0));
    sy = Math.max(0, Math.min(h - 1, sy | 0));
    var seed = sy * w + sx;
    var sl = L[seed], sa = A[seed], sb = B[seed];

    // Perceptual, slightly super-linear so the slider has fine control down low.
    var t = Math.pow(Math.max(0, Math.min(100, tol)) / 100, 1.7) * 0.42;
    var gt2 = t * t;
    var edgeTol = M.EDGE_BASE + t * M.EDGE_SLOPE;

    function globalOk(i) {
      var dl = (L[i] - sl) * M.LUM_WEIGHT, da = A[i] - sa, db = B[i] - sb;
      return dl * dl + da * da + db * db <= gt2;
    }
    function edgeOk(i) { return G[i] <= edgeTol; }

    var out = new Uint8Array(w * h);
    if (!contiguous) {
      for (var i = 0; i < w * h; i++) if (globalOk(i)) out[i] = 255;
      return out;
    }
    if (!globalOk(seed)) { out[seed] = 255; return out; }

    // Scanline flood fill — an order of magnitude fewer stack ops than 4-way.
    var stack = new Int32Array(Math.max(1024, w * h)), sp = 0;
    stack[sp++] = seed;
    while (sp > 0) {
      var p = stack[--sp];
      if (out[p]) continue;
      var y = (p / w) | 0, row = y * w;
      var x1 = p - row;
      while (x1 > 0 && !out[row + x1 - 1] && globalOk(row + x1 - 1) && edgeOk(row + x1)) x1--;
      var x2 = p - row;
      while (x2 < w - 1 && !out[row + x2 + 1] && globalOk(row + x2 + 1) && edgeOk(row + x2)) x2++;
      for (var x = x1; x <= x2; x++) {
        var c = row + x;
        out[c] = 255;
        if (y > 0) { var u = c - w; if (!out[u] && globalOk(u) && edgeOk(c) && sp < stack.length) stack[sp++] = u; }
        if (y < h - 1) { var dn = c + w; if (!out[dn] && globalOk(dn) && edgeOk(c) && sp < stack.length) stack[sp++] = dn; }
      }
    }
    return out;
  };

  /** Soft round brush. mode: 'add' | 'erase'. */
  M.brush = function (mask, w, h, cx, cy, radius, hardness, mode) {
    var r = Math.max(1, radius), r2 = r * r;
    var x0 = Math.max(0, Math.floor(cx - r)), x1 = Math.min(w - 1, Math.ceil(cx + r));
    var y0 = Math.max(0, Math.floor(cy - r)), y1 = Math.min(h - 1, Math.ceil(cy + r));
    var inner = Math.max(0, Math.min(0.99, hardness == null ? 0.6 : hardness));
    for (var y = y0; y <= y1; y++) {
      for (var x = x0; x <= x1; x++) {
        var dx = x - cx, dy = y - cy, d2 = dx * dx + dy * dy;
        if (d2 > r2) continue;
        var d = Math.sqrt(d2) / r, a;
        if (d <= inner) a = 1;
        else { a = 1 - (d - inner) / (1 - inner); a = a * a * (3 - 2 * a); }
        var i = y * w + x, v = a * 255;
        if (mode === 'erase') { if (255 - v < mask[i]) mask[i] = 255 - v; }
        else if (v > mask[i]) mask[i] = v;
      }
    }
    return mask;
  };

  /** Separable box blur x3 ~= gaussian. Feathering is what kills halo edges. */
  M.feather = function (mask, w, h, radius) {
    if (radius <= 0) return mask;
    var r = Math.round(radius), src = Float32Array.from(mask), tmp = new Float32Array(mask.length);
    for (var pass = 0; pass < 3; pass++) {
      boxH(src, tmp, w, h, r); boxV(tmp, src, w, h, r);
    }
    for (var i = 0; i < mask.length; i++) mask[i] = Math.max(0, Math.min(255, src[i]));
    return mask;
  };

  function boxH(src, dst, w, h, r) {
    for (var y = 0; y < h; y++) {
      var row = y * w, sum = 0, n = 0, i;
      for (i = 0; i <= r && i < w; i++) { sum += src[row + i]; n++; }
      for (var x = 0; x < w; x++) {
        dst[row + x] = sum / n;
        var add = x + r + 1, sub = x - r;
        if (add < w) { sum += src[row + add]; n++; }
        if (sub >= 0) { sum -= src[row + sub]; n--; }
      }
    }
  }
  function boxV(src, dst, w, h, r) {
    for (var x = 0; x < w; x++) {
      var sum = 0, n = 0, i;
      for (i = 0; i <= r && i < h; i++) { sum += src[i * w + x]; n++; }
      for (var y = 0; y < h; y++) {
        dst[y * w + x] = sum / n;
        var add = y + r + 1, sub = y - r;
        if (add < h) { sum += src[add * w + x]; n++; }
        if (sub >= 0) { sum -= src[sub * w + x]; n--; }
      }
    }
  }

  /**
   * Grow (+) or shrink (-) the selection. Implemented as blur-then-rethreshold:
   * shrinking by a pixel or two is the standard fix for the pale fringe you get
   * when a wand selection includes a little of the trim next door.
   */
  M.expand = function (mask, w, h, amount) {
    if (!amount) return mask;
    var r = Math.abs(amount);
    var work = Uint8Array.from(mask);
    M.feather(work, w, h, r);
    var thresh = amount > 0 ? 255 * 0.30 : 255 * 0.72;
    for (var i = 0; i < mask.length; i++) mask[i] = work[i] >= thresh ? 255 : 0;
    return mask;
  };

  /** Drop specks left behind by a wand on noisy siding. */
  M.despeckle = function (mask, w, h, minArea) {
    minArea = minArea || 24;
    var seen = new Uint8Array(w * h), stack = new Int32Array(w * h), comp = new Int32Array(w * h);
    for (var s = 0; s < w * h; s++) {
      if (seen[s] || !mask[s]) continue;
      var sp = 0, cn = 0; stack[sp++] = s; seen[s] = 1;
      while (sp > 0) {
        var p = stack[--sp]; comp[cn++] = p;
        var x = p % w, y = (p / w) | 0;
        if (x > 0 && !seen[p - 1] && mask[p - 1]) { seen[p - 1] = 1; stack[sp++] = p - 1; }
        if (x < w - 1 && !seen[p + 1] && mask[p + 1]) { seen[p + 1] = 1; stack[sp++] = p + 1; }
        if (y > 0 && !seen[p - w] && mask[p - w]) { seen[p - w] = 1; stack[sp++] = p - w; }
        if (y < h - 1 && !seen[p + w] && mask[p + w]) { seen[p + w] = 1; stack[sp++] = p + w; }
      }
      if (cn < minArea) for (var k = 0; k < cn; k++) mask[comp[k]] = 0;
    }
    return mask;
  };

  M.combine = function (target, add, mode) {
    for (var i = 0; i < target.length; i++) {
      if (mode === 'subtract') { var v = 255 - add[i]; if (v < target[i]) target[i] = v; }
      else if (mode === 'intersect') { if (add[i] < target[i]) target[i] = add[i]; }
      else if (add[i] > target[i]) target[i] = add[i];
    }
    return target;
  };

  M.count = function (mask) { var c = 0; for (var i = 0; i < mask.length; i++) if (mask[i] > 127) c++; return c; };

  /* ---------------------------------------------------------- serialization */

  /** Masks travel as ordinary PNGs. Grayscale in RGB with alpha pinned at 255 —
   *  storing coverage in the alpha channel round-trips badly through the
   *  canvas's premultiplication. */
  M.toDataURL = function (mask, w, h) {
    var cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    var cx = cv.getContext('2d'), img = cx.createImageData(w, h), d = img.data;
    for (var i = 0; i < w * h; i++) {
      var p = i << 2, v = mask[i];
      d[p] = d[p + 1] = d[p + 2] = v; d[p + 3] = 255;
    }
    cx.putImageData(img, 0, 0);
    return cv.toDataURL('image/png');
  };

  M.fromImage = function (img, w, h) {
    var cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    var cx = cv.getContext('2d');
    cx.drawImage(img, 0, 0, w, h);
    var d = cx.getImageData(0, 0, w, h).data, out = new Uint8Array(w * h);
    for (var i = 0; i < w * h; i++) out[i] = d[i << 2];
    return out;
  };

  M.load = function (src, w, h) {
    return new Promise(function (res, rej) {
      var img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = function () { res(M.fromImage(img, w, h)); };
      img.onerror = function () { rej(new Error('mask failed to load: ' + String(src).slice(0, 80))); };
      img.src = src;
    });
  };
})(typeof window !== 'undefined' ? window : this);

/* ===== src/demoscene.js ===== */
/* PaintViz — built-in demo scenes
 *
 * Drawn procedurally so the widget works with zero assets, offline, even from a
 * file:// URL. They are a DEMO, not the product: the real value comes from your
 * own job photos (see studio.html) or from the visitor's own upload.
 *
 * Each scene is built the way a photograph actually forms — a flat ALBEDO layer
 * (what color is this surface) multiplied by a separate LIGHT layer (how much of
 * what color lands on it: sun angle, eave shadows, ambient occlusion in the
 * corners, bounce off the ground). So the engine faces a genuine decomposition
 * here, not a rigged one.
 */
(function (global) {
  'use strict';
  var PaintViz = (global.PaintViz = global.PaintViz || {});
  var D = (PaintViz.demo = {});

  function cv(w, h) { var c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
  function rnd(seed) { var s = seed || 1; return function () { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296; }; }

  /** Fine grain so flat fills read as a photographed surface, not vector art. */
  function grain(ctx, w, h, amt, seed) {
    var img = ctx.getImageData(0, 0, w, h), d = img.data, r = rnd(seed || 7);
    for (var i = 0; i < w * h; i++) {
      var n = (r() - 0.5) * amt, p = i << 2;
      d[p] += n; d[p + 1] += n; d[p + 2] += n;
    }
    ctx.putImageData(img, 0, 0);
  }

  /** The actual "albedo x light" step. */
  function multiply(albedo, light, w, h) {
    var out = cv(w, h), o = out.getContext('2d', { willReadFrequently: true });
    o.drawImage(albedo, 0, 0);
    o.globalCompositeOperation = 'multiply';
    o.drawImage(light, 0, 0);
    o.globalCompositeOperation = 'source-over';
    return out;
  }

  /* --------------------------------------------------------------- builder */

  /**
   * Region masks come from an ID BUFFER drawn in lockstep with the albedo layer.
   * Last writer wins, which gives correct occlusion for free: the wall behind the
   * range is not part of the wall you can repaint, because the range was drawn
   * over it. Independent per-region mask canvases cannot express that, and the
   * result is a "wall" selection that repaints the floor and the appliances.
   */
  function Builder(w, h, regions) {
    this.w = w; this.h = h;
    this.regions = regions;
    this.idOf = {};
    // IDs spaced far apart so an antialiased edge between two of them can never
    // land within tolerance of a third.
    for (var i = 0; i < regions.length; i++) this.idOf[regions[i].id] = 22 + i * 26;
    this.albedo = cv(w, h); this.ac = this.albedo.getContext('2d');
    this.light = cv(w, h); this.lc = this.light.getContext('2d');
    this.lc.fillStyle = '#fff'; this.lc.fillRect(0, 0, w, h);
    this.id = cv(w, h); this.ic = this.id.getContext('2d', { willReadFrequently: true });
    this.ic.fillStyle = '#000'; this.ic.fillRect(0, 0, w, h);
    this.scratch = cv(w, h); this.sc = this.scratch.getContext('2d');
  }

  /**
   * Draw into the albedo layer and stamp the same shape into the ID buffer.
   * The callback may set its own gradients and fills, so the ID stamp is taken
   * from the shape's ALPHA via source-in rather than by replaying its colors.
   */
  Builder.prototype.paint = function (regionId, color, draw) {
    var a = this.ac;
    a.save();
    if (color) { a.fillStyle = color; a.strokeStyle = color; }
    draw(a);
    a.restore();

    var v = regionId ? this.idOf[regionId] : 0;
    var sc = this.sc;
    sc.save();
    sc.clearRect(0, 0, this.w, this.h);
    if (color) { sc.fillStyle = color; sc.strokeStyle = color; }
    draw(sc);
    sc.globalCompositeOperation = 'source-in';
    sc.fillStyle = 'rgb(' + v + ',' + v + ',' + v + ')';
    sc.fillRect(0, 0, this.w, this.h);
    sc.restore();
    this.ic.drawImage(this.scratch, 0, 0);
  };

  /** A non-paintable object: glass, roofing, appliances, floor, planting.
   *  Stamps ID 0, punching out whatever region was behind it. */
  Builder.prototype.plain = function (color, draw) { this.paint(null, color, draw); };

  /** Darken the light layer. `clip` confines it to a silhouette — without one,
   *  a shadow gradient sized to the wall spills a hard rectangle across the sky. */
  Builder.prototype.shade = function (draw, clip) {
    var l = this.lc; l.save();
    if (clip) { l.beginPath(); clip(l); l.clip(); }
    l.globalCompositeOperation = 'multiply'; draw(l); l.restore();
  };
  Builder.prototype.lighten = function (draw, clip) {
    var l = this.lc; l.save();
    if (clip) { l.beginPath(); clip(l); l.clip(); }
    l.globalCompositeOperation = 'screen'; draw(l); l.restore();
  };

  Builder.prototype.finish = function (opts) {
    opts = opts || {};
    var w = this.w, h = this.h;
    var out = multiply(this.albedo, this.light, w, h);
    var o = out.getContext('2d', { willReadFrequently: true });
    grain(o, w, h, opts.grain == null ? 5 : opts.grain, opts.seed);
    var g = o.createRadialGradient(w / 2, h * 0.46, h * 0.30, w / 2, h * 0.5, h * 1.05);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.20)');
    o.fillStyle = g; o.fillRect(0, 0, w, h);

    var idd = this.ic.getImageData(0, 0, w, h).data;
    var regions = [];
    for (var i = 0; i < this.regions.length; i++) {
      var r = this.regions[i], want = this.idOf[r.id];
      var mask = new Uint8Array(w * h), n = 0;
      for (var k = 0; k < w * h; k++) {
        if (Math.abs(idd[k << 2] - want) <= 7) { mask[k] = 255; n++; }
      }
      if (!n) continue;
      PaintViz.mask.despeckle(mask, w, h, 14);
      PaintViz.mask.feather(mask, w, h, 1);
      regions.push({ id: r.id, name: r.name, sheen: r.sheen, color: r.color, mask: mask });
    }
    return { canvas: out, width: w, height: h, regions: regions };
  };

  /* -------------------------------------------------------------- exterior */

  D.exterior = function () {
    var w = 1400, h = 900;
    var REG = [
      { id: 'siding', name: 'Siding / Body', sheen: 'satin', color: '#c9c4b4' },
      { id: 'trim', name: 'Trim & Fascia', sheen: 'semi-gloss', color: '#f4f1e9' },
      { id: 'door', name: 'Front Door', sheen: 'gloss', color: '#7c4b3a' },
      { id: 'shutters', name: 'Shutters', sheen: 'satin', color: '#3f4a43' },
      { id: 'garage', name: 'Garage Door', sheen: 'satin', color: '#e8e4da' },
      { id: 'foundation', name: 'Foundation', sheen: 'flat', color: '#9a938a' }
    ];
    var b = new Builder(w, h, REG), r = rnd(11);
    var X = 250, Y = 210, BW = 700, BH = 400;
    var GX = X + BW, GW = 300, GY = Y + 120;

    b.plain(null, function (c) {                                  // sky
      var sky = c.createLinearGradient(0, 0, 0, h * 0.72);
      sky.addColorStop(0, '#5d90c4'); sky.addColorStop(0.55, '#9dc0dc'); sky.addColorStop(1, '#d6e2e9');
      c.fillStyle = sky; c.fillRect(0, 0, w, h);
      var lawn = c.createLinearGradient(0, h * 0.70, 0, h);
      lawn.addColorStop(0, '#6f8047'); lawn.addColorStop(1, '#4d5c31');
      c.fillStyle = lawn; c.fillRect(0, h * 0.70, w, h * 0.30);
      var t = rnd(41);
      for (var i = 0; i < 90; i++) {                              // distant tree line
        c.fillStyle = 'rgba(48,64,42,' + (0.25 + t() * 0.35) + ')';
        c.beginPath(); c.arc(t() * w, h * 0.70 - t() * 46, 18 + t() * 34, 0, 6.284); c.fill();
      }
    });

    b.plain(null, function (c) {                                  // roofing
      c.fillStyle = '#4a4744';
      c.beginPath(); c.moveTo(X - 40, Y); c.lineTo(X + BW / 2, Y - 155); c.lineTo(X + BW + 40, Y); c.closePath(); c.fill();
      c.fillStyle = '#413e3b';
      c.beginPath(); c.moveTo(GX - 20, GY); c.lineTo(GX + GW / 2, GY - 78); c.lineTo(GX + GW + 30, GY); c.closePath(); c.fill();
      var t = rnd(53);
      c.save();
      c.beginPath();                                            // courses stay on the roof
      c.moveTo(X - 40, Y); c.lineTo(X + BW / 2, Y - 155); c.lineTo(X + BW + 40, Y); c.closePath();
      c.moveTo(GX - 20, GY); c.lineTo(GX + GW / 2, GY - 78); c.lineTo(GX + GW + 30, GY); c.closePath();
      c.clip();
      c.lineWidth = 2;
      for (var i = 0; i < 26; i++) {
        c.strokeStyle = 'rgba(0,0,0,' + (0.05 + t() * 0.05) + ')';
        c.beginPath(); c.moveTo(X - 60, Y - i * 6); c.lineTo(X + BW + 60, Y - i * 6); c.stroke();
        c.beginPath(); c.moveTo(GX - 30, GY - i * 5); c.lineTo(GX + GW + 40, GY - i * 5); c.stroke();
      }
      c.restore();
    });

    b.paint('siding', '#c9c4b4', function (c) { c.fillRect(X, Y, BW, BH); c.fillRect(GX, GY, GW, BH - 120); });
    b.paint('siding', 'rgba(0,0,0,0.07)', function (c) {          // lap boards, batched
      for (var y = Y + 12; y < Y + BH; y += 15) {
        c.fillRect(X, y, BW, 2);
        if (y > GY) c.fillRect(GX, y, GW, 2);
      }
    });
    b.paint('foundation', '#9a938a', function (c) { c.fillRect(X - 10, Y + BH - 46, BW + GW + 40, 46); });

    var WINS = [[X + 70, Y + 60, 110, 140], [X + 300, Y + 60, 110, 140], [X + 530, Y + 60, 110, 140],
                [X + 70, Y + 250, 110, 120], [X + 530, Y + 250, 110, 120]];
    b.paint('trim', '#f4f1e9', function (c) {                     // window casings
      for (var i = 0; i < WINS.length; i++) { var q = WINS[i]; c.fillRect(q[0] - 9, q[1] - 9, q[2] + 18, q[3] + 18); }
    });
    b.plain(null, function (c) {                                  // glass
      for (var i = 0; i < WINS.length; i++) {
        var q = WINS[i], wx = q[0], wy = q[1], ww = q[2], wh = q[3];
        var gl = c.createLinearGradient(wx, wy, wx + ww, wy + wh);
        gl.addColorStop(0, '#5f7686'); gl.addColorStop(0.45, '#33454f'); gl.addColorStop(1, '#7d94a1');
        c.fillStyle = gl; c.fillRect(wx, wy, ww, wh);
        c.fillStyle = 'rgba(255,255,255,0.30)';
        c.beginPath(); c.moveTo(wx, wy + wh * 0.75); c.lineTo(wx + ww * 0.62, wy);
        c.lineTo(wx + ww, wy); c.lineTo(wx, wy + wh); c.closePath(); c.fill();
      }
    });
    b.paint('trim', '#f4f1e9', function (c) {                     // muntins
      for (var i = 0; i < WINS.length; i++) {
        var q = WINS[i];
        c.fillRect(q[0] + q[2] / 2 - 3, q[1], 6, q[3]);
        c.fillRect(q[0], q[1] + q[3] / 2 - 3, q[2], 6);
      }
    });
    b.paint('shutters', '#3f4a43', function (c) {
      for (var i = 0; i < WINS.length; i++) {
        var q = WINS[i];
        c.fillRect(q[0] - 34, q[1] - 9, 24, q[3] + 18);
        c.fillRect(q[0] + q[2] + 10, q[1] - 9, 24, q[3] + 18);
      }
    });

    var DX = X + 300, DY = Y + 230, DW = 108, DH = 172;
    b.paint('trim', '#f4f1e9', function (c) { c.fillRect(DX - 14, DY - 14, DW + 28, DH + 14); });
    b.paint('door', '#7c4b3a', function (c) { c.fillRect(DX, DY, DW, DH); });
    b.paint('door', 'rgba(0,0,0,0.13)', function (c) {
      c.fillRect(DX + 14, DY + 16, DW - 28, 58); c.fillRect(DX + 14, DY + 92, DW - 28, 62);
    });
    b.plain('#d8c37a', function (c) { c.beginPath(); c.arc(DX + DW - 20, DY + DH / 2, 5, 0, 6.284); c.fill(); });

    var RX = GX + 34, RY = GY + 96, RW = GW - 68, RH = 150;
    b.paint('garage', '#e8e4da', function (c) { c.fillRect(RX, RY, RW, RH); });
    b.paint('garage', 'rgba(0,0,0,0.10)', function (c) {
      for (var gy = 0; gy < 3; gy++) for (var gx = 0; gx < 2; gx++) {
        c.fillRect(RX + 10 + gx * (RW / 2), RY + 8 + gy * (RH / 3), RW / 2 - 16, RH / 3 - 14);
      }
    });

    b.paint('trim', '#f4f1e9', function (c) {                     // corner boards, fascia, porch
      c.fillRect(X - 4, Y, 16, BH - 46); c.fillRect(X + BW - 12, Y, 16, BH - 46);
      c.fillRect(GX + GW - 12, GY, 16, BH - 166);
      c.fillRect(X - 44, Y - 6, BW + 88, 18); c.fillRect(GX - 24, GY - 6, GW + 56, 16);
      c.fillRect(DX - 78, DY - 30, 16, DH + 30); c.fillRect(DX + DW + 62, DY - 30, 16, DH + 30);
      c.fillRect(DX - 92, DY - 42, DW + 200, 16);
    });

    b.plain(null, function (c) {                                  // foundation planting
      var t = rnd(29);
      for (var i = 0; i < 150; i++) {
        c.fillStyle = 'rgb(' + (48 + t() * 30 | 0) + ',' + (78 + t() * 34 | 0) + ',' + (42 + t() * 22 | 0) + ')';
        c.beginPath();
        c.arc(X - 20 + t() * (BW + GW + 70), Y + BH + 4 + t() * 44, 12 + t() * 24, 0, 6.284);
        c.fill();
      }
    });

    /* ---- irradiance: sun from upper-left, sky fill, ground bounce ---- */
    function houseClip(c) {                                     // everything the walls occupy
      c.rect(X - 48, Y - 10, BW + 96, BH + 2);
      c.rect(GX - 28, GY - 10, GW + 60, BH - 108);
    }
    b.shade(function (l) {
      // the garage wing turns away from the sun
      l.fillStyle = 'rgba(150,160,176,0.42)'; l.fillRect(GX - 30, GY - 90, GW + 62, 520);
      // eave shadow raking down the wall
      var eg = l.createLinearGradient(0, Y - 8, 0, Y + 104);
      eg.addColorStop(0, 'rgba(104,116,138,0.62)'); eg.addColorStop(1, 'rgba(255,255,255,1)');
      l.fillStyle = eg; l.fillRect(X - 50, Y - 10, BW + 100, 114);
      // ambient occlusion where wall meets ground
      var ag = l.createLinearGradient(0, Y + BH - 110, 0, Y + BH);
      ag.addColorStop(0, 'rgba(255,255,255,1)'); ag.addColorStop(1, 'rgba(126,134,150,0.62)');
      l.fillStyle = ag; l.fillRect(X - 60, Y + BH - 110, BW + GW + 120, 112);
      // porch overhang across the entry
      l.fillStyle = 'rgba(126,136,160,0.30)'; l.fillRect(DX - 96, DY - 46, DW + 210, DH + 50);
      // broad falloff away from the sun
      var fg = l.createLinearGradient(X, 0, X + BW + GW, 0);
      fg.addColorStop(0, 'rgba(255,255,255,1)'); fg.addColorStop(1, 'rgba(198,206,220,0.85)');
      l.fillStyle = fg; l.fillRect(X - 60, Y - 20, BW + GW + 120, BH + 30);
    }, houseClip);
    b.lighten(function (l) {                                     // sun-warmed upper left
      var sg = l.createRadialGradient(X + 60, Y + 40, 20, X + 60, Y + 40, 640);
      sg.addColorStop(0, 'rgba(255,240,206,0.30)'); sg.addColorStop(1, 'rgba(0,0,0,0)');
      l.fillStyle = sg; l.fillRect(0, 0, w, h);
    }, houseClip);

    return b.finish({ seed: 3, grain: 5 });
  };

  /* --------------------------------------------------------------- kitchen */

  D.kitchen = function () {
    var w = 1400, h = 900;
    var REG = [
      { id: 'upper', name: 'Upper Cabinets', sheen: 'satin', color: '#eceae3' },
      { id: 'lower', name: 'Lower Cabinets', sheen: 'satin', color: '#5b6b6a' },
      { id: 'island', name: 'Island', sheen: 'satin', color: '#3d4a55' },
      { id: 'wall', name: 'Walls', sheen: 'eggshell', color: '#ded8cc' },
      { id: 'backsplash', name: 'Backsplash', sheen: 'gloss', color: '#f2f0ea' },
      { id: 'trim', name: 'Trim & Crown', sheen: 'semi-gloss', color: '#fbfaf6' }
    ];
    var b = new Builder(w, h, REG);

    b.paint('wall', '#ded8cc', function (c) { c.fillRect(0, 0, w, h); });
    b.plain(null, function (c) {                                  // floor
      c.fillStyle = '#8a6f52';
      c.beginPath(); c.moveTo(0, 690); c.lineTo(w, 690); c.lineTo(w, h); c.lineTo(0, h); c.closePath(); c.fill();
      var t = rnd(67);
      for (var i = 0; i < 16; i++) {
        c.fillStyle = 'rgba(0,0,0,' + (0.03 + t() * 0.07) + ')';
        c.fillRect(0, 690 + i * 14, w, 5 + t() * 4);
      }
    });

    b.paint('trim', '#fbfaf6', function (c) { c.fillRect(0, 66, w, 34); });
    b.paint('backsplash', '#f2f0ea', function (c) { c.fillRect(150, 372, 1100, 128); });
    b.paint('backsplash', 'rgba(0,0,0,0.09)', function (c) {      // grout
      c.lineWidth = 2; c.strokeStyle = 'rgba(0,0,0,0.09)';
      for (var x = 150; x <= 1250; x += 62) { c.beginPath(); c.moveTo(x, 372); c.lineTo(x, 500); c.stroke(); }
      for (var y = 372; y <= 500; y += 32) { c.beginPath(); c.moveTo(150, y); c.lineTo(1250, y); c.stroke(); }
    });

    /** Shaker doors: frame + recessed centre panel, all one region. */
    function doors(reg, base, boxes) {
      b.paint(reg, base, function (c) {
        for (var i = 0; i < boxes.length; i++) { var q = boxes[i]; c.fillRect(q[0], q[1], q[2], q[3]); }
      });
      b.paint(reg, 'rgba(0,0,0,0.10)', function (c) {
        for (var i = 0; i < boxes.length; i++) { var q = boxes[i]; c.fillRect(q[0] + 13, q[1] + 13, q[2] - 26, q[3] - 26); }
      });
      b.paint(reg, 'rgba(255,255,255,0.16)', function (c) {
        for (var i = 0; i < boxes.length; i++) { var q = boxes[i]; c.fillRect(q[0] + 13, q[1] + 13, q[2] - 26, 4); }
      });
      b.plain('#3a3d40', function (c) {                            // pulls
        for (var i = 0; i < boxes.length; i++) { var q = boxes[i]; c.fillRect(q[0] + q[2] - 26, q[1] + q[3] / 2 - 26, 7, 52); }
      });
    }

    var up = [], i2;
    for (i2 = 0; i2 < 7; i2++) up.push([152 + i2 * 158, 100, 148, 262]);
    doors('upper', '#eceae3', up);
    var lo = [];
    for (i2 = 0; i2 < 4; i2++) lo.push([152 + i2 * 158, 540, 148, 150]);
    for (i2 = 0; i2 < 2; i2++) lo.push([940 + i2 * 158, 540, 148, 150]);
    doors('lower', '#5b6b6a', lo);

    b.plain(null, function (c) {                                   // range
      c.fillStyle = '#3f4347'; c.fillRect(786, 500, 148, 190);
      c.fillStyle = '#2b2e31'; c.fillRect(800, 540, 120, 90);
    });
    b.plain(null, function (c) {                                   // countertop (stone, not painted)
      c.fillStyle = '#d8d4cc'; c.fillRect(148, 500, 1104, 40);
      c.fillStyle = 'rgba(255,255,255,0.5)'; c.fillRect(148, 500, 1104, 6);
      var t = rnd(83);
      for (var i = 0; i < 1100; i++) {                            // neutral stone fleck
        var v = 118 + t() * 92;
        c.fillStyle = 'rgba(' + (v | 0) + ',' + (v * 0.985 | 0) + ',' + (v * 0.95 | 0) + ',' + (0.30 + t() * 0.35) + ')';
        c.fillRect(150 + t() * 1100, 502 + t() * 36, 2 + t() * 3, 2);
      }
    });

    doors('island', '#3d4a55', [[392, 690, 256, 182], [652, 690, 256, 182]]);
    b.plain(null, function (c) {                                  // island top
      c.fillStyle = '#d8d4cc'; c.fillRect(360, 644, 580, 46);
      c.fillStyle = 'rgba(255,255,255,0.45)'; c.fillRect(360, 644, 580, 7);
      var t = rnd(97);
      for (var i = 0; i < 600; i++) {
        var v = 118 + t() * 92;
        c.fillStyle = 'rgba(' + (v | 0) + ',' + (v * 0.985 | 0) + ',' + (v * 0.95 | 0) + ',' + (0.30 + t() * 0.35) + ')';
        c.fillRect(362 + t() * 576, 648 + t() * 40, 2 + t() * 3, 2);
      }
    });

    b.plain('#eef4f7', function (c) { c.fillRect(1290, 150, 96, 330); });   // window glass
    b.paint('trim', '#fbfaf6', function (c) {
      c.fillRect(1278, 138, 120, 14); c.fillRect(1278, 468, 120, 16);
      c.fillRect(1278, 138, 14, 346); c.fillRect(1384, 138, 14, 346);
    });

    /* ---- irradiance: window light from the right, AO under everything ---- */
    b.shade(function (l) {
      var wg = l.createLinearGradient(w, 0, 240, 0);
      wg.addColorStop(0, 'rgba(255,255,255,1)'); wg.addColorStop(1, 'rgba(150,158,178,0.72)');
      l.fillStyle = wg; l.fillRect(0, 0, w, h);
      var ug = l.createLinearGradient(0, 362, 0, 452);
      ug.addColorStop(0, 'rgba(74,84,104,0.66)'); ug.addColorStop(1, 'rgba(255,255,255,1)');
      l.fillStyle = ug; l.fillRect(150, 362, 1100, 90);
      var tg = l.createLinearGradient(0, 640, 0, 700);
      tg.addColorStop(0, 'rgba(255,255,255,1)'); tg.addColorStop(1, 'rgba(70,76,92,0.70)');
      l.fillStyle = tg; l.fillRect(0, 640, w, 60);
      l.fillStyle = 'rgba(60,68,86,0.38)'; l.fillRect(360, 862, 590, 38);   // island contact shadow
      var cg = l.createLinearGradient(0, 60, 0, 190);
      cg.addColorStop(0, 'rgba(96,104,124,0.55)'); cg.addColorStop(1, 'rgba(255,255,255,1)');
      l.fillStyle = cg; l.fillRect(0, 60, w, 130);
    });
    b.lighten(function (l) {
      var sg = l.createRadialGradient(1330, 300, 30, 1330, 300, 780);
      sg.addColorStop(0, 'rgba(255,248,226,0.42)'); sg.addColorStop(1, 'rgba(0,0,0,0)');
      l.fillStyle = sg; l.fillRect(0, 0, w, h);
    });

    return b.finish({ seed: 5, grain: 4 });
  };

  D.list = [
    { id: 'exterior', name: 'Exterior — Two-Story', build: D.exterior },
    { id: 'kitchen', name: 'Kitchen & Cabinets', build: D.kitchen }
  ];
})(typeof window !== 'undefined' ? window : this);

/* ===== src/widget.js ===== */
/* PaintViz — visitor-facing widget
 *
 *   PaintViz.mount('#el', { brand: {...}, scenes: [...], lead: {...} })
 *
 * Everything runs client-side. No network calls except loading your own scene
 * photos, and the visitor's uploaded photo never leaves their browser.
 */
(function (global) {
  'use strict';
  var PaintViz = (global.PaintViz = global.PaintViz || {});
  var C = PaintViz.color, MK = PaintViz.mask;

  var MAX_EDGE = 1600; // working resolution: sharp enough to download, fast enough to feel live

  function el(tag, cls, html) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html != null) n.innerHTML = html;
    return n;
  }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

  /* Role inference: lets designer schemes apply to any scene, including a
   * visitor's own photo, without the scene author tagging every surface. */
  function inferRole(id, name) {
    var s = (id + ' ' + (name || '')).toLowerCase();
    if (/upper/.test(s)) return 'cabinetUpper';
    if (/lower|base cab/.test(s)) return 'cabinetLower';
    if (/island/.test(s)) return 'island';
    // ORDER MATTERS: "Garage Door" contains "door". Check the more specific
    // element first or the garage inherits the front-door accent color.
    if (/garage/.test(s)) return 'garage';
    if (/shutter/.test(s)) return 'shutter';
    if (/trim|fascia|crown|casing|soffit|column|post|railing/.test(s)) return 'trim';
    if (/door|entry/.test(s)) return 'accent';
    if (/foundation|brick|stone|backsplash|masonry|skirt/.test(s)) return 'masonry';
    if (/wall|ceiling/.test(s)) return 'wall';
    return 'body';
  }

  /* ------------------------------------------------------------------ Viz */

  function Viz(root, opts) {
    this.opts = opts = opts || {};
    this.root = root;
    this.palette = opts.palette || PaintViz.palette;
    this.brand = opts.brand || {};
    this.accent = this.brand.accent || '#2a78d6';
    var demos = PaintViz.demo.list.map(function (d) {
      return { id: d.id, name: d.name, type: 'demo', build: d.build };
    });
    this.scenes = opts.scenes || (opts.includeDemos === false ? [] : demos);
    this.state = { sceneId: null, selected: null, compare: 0, history: [] };
    this.customScenes = [];
    this._build();
    var self = this;
    var start = function () {
      var fromUrl = self._readUrl();
      var first = self.scenes[0];
      if (!first) { self.$.loading.textContent = 'Add a scene, or upload a photo to begin.'; return; }
      self.loadScene((fromUrl && fromUrl.sceneId) || opts.defaultScene || first.id, fromUrl);
    };
    // scene files are plain JSON written by the studio; fetch them before first paint
    if (opts.sceneFiles && opts.sceneFiles.length) {
      Promise.all(opts.sceneFiles.map(function (u) {
        return fetch(u).then(function (r) {
          if (!r.ok) throw new Error(u + ' -> HTTP ' + r.status);
          return r.json();
        }).then(function (j) {
          j.type = 'url';
          if (j.image && !/^(data:|https?:|\/)/.test(j.image)) {
            j.image = u.replace(/[^/]*$/, '') + j.image;   // resolve relative to the scene file
          }
          (j.regions || []).forEach(function (r2) {
            if (r2.mask && !/^(data:|https?:|\/)/.test(r2.mask)) r2.mask = u.replace(/[^/]*$/, '') + r2.mask;
          });
          return j;
        }).catch(function (e) { console.error('[PaintViz] scene file failed:', e); return null; });
      })).then(function (loaded) {
        self.scenes = loaded.filter(Boolean).concat(self.scenes);
        self._buildScenes();
        start();
      });
    } else start();
  }

  Viz.prototype._build = function () {
    var self = this;
    var r = this.root;
    r.classList.add('pv');
    r.style.setProperty('--pv-accent', this.accent);
    r.innerHTML =
      '<div class="pv-stage">' +
        '<div class="pv-canvas-wrap" data-pv="wrap">' +
          '<canvas class="pv-canvas pv-painted" data-pv="painted"></canvas>' +
          '<canvas class="pv-canvas pv-original" data-pv="original"></canvas>' +
          '<canvas class="pv-canvas pv-hover" data-pv="hover"></canvas>' +
          '<div class="pv-divider" data-pv="divider"><span></span></div>' +
          '<div class="pv-hint" data-pv="hint"></div>' +
          '<div class="pv-loading" data-pv="loading">Preparing scene…</div>' +
        '</div>' +
        '<div class="pv-stagebar">' +
          '<div class="pv-scenes" data-pv="scenes"></div>' +
          '<div class="pv-tools" data-pv="tools">' +
            '<button class="pv-btn" data-pv="compare" title="Drag to compare before and after">Before / After</button>' +
            '<button class="pv-btn" data-pv="reset" title="Start over">Reset</button>' +
            '<button class="pv-btn" data-pv="download" title="Save this image">Save Image</button>' +
            '<button class="pv-btn" data-pv="share" title="Copy a link to this exact combination">Copy Link</button>' +
          '</div>' +
        '</div>' +
      '</div>' +
      '<div class="pv-panel">' +
        '<div class="pv-section pv-surfaces-sec">' +
          '<h4>1. Choose a surface</h4>' +
          '<div class="pv-surfaces" data-pv="surfaces"></div>' +
        '</div>' +
        '<div class="pv-section">' +
          '<h4>2. Pick a color <span class="pv-forsurf" data-pv="forsurf"></span></h4>' +
          '<div class="pv-palbar">' +
            '<input class="pv-search" type="search" placeholder="Search colors…" data-pv="search">' +
            '<label class="pv-custom" title="Any custom color">' +
              '<input type="color" data-pv="custom" value="#7d95a6"><span>Custom</span>' +
            '</label>' +
          '</div>' +
          '<div class="pv-collections" data-pv="collections"></div>' +
          '<div class="pv-swatches" data-pv="swatches"></div>' +
        '</div>' +
        '<div class="pv-section">' +
          '<h4>3. Finish</h4>' +
          '<div class="pv-sheens" data-pv="sheens"></div>' +
        '</div>' +
        '<div class="pv-section">' +
          '<h4>Designer schemes</h4>' +
          '<div class="pv-schemes" data-pv="schemes"></div>' +
        '</div>' +
        '<div class="pv-section pv-cta-sec">' +
          '<button class="pv-cta" data-pv="quote">Get a quote with these colors</button>' +
          '<p class="pv-note" data-pv="disclaimer">Colors shown are a digital simulation. Screens vary — always confirm with a physical sample before buying paint.</p>' +
        '</div>' +
      '</div>' +
      '<div class="pv-modal" data-pv="modal" hidden><div class="pv-modal-inner" data-pv="modalinner"></div></div>';

    this.$ = {};
    r.querySelectorAll('[data-pv]').forEach(function (n) { self.$[n.getAttribute('data-pv')] = n; });

    this.ctxPainted = this.$.painted.getContext('2d');
    this.ctxOriginal = this.$.original.getContext('2d');
    this.ctxHover = this.$.hover.getContext('2d');

    this._buildScenes();
    this._buildCollections();
    this._buildSheens();
    this._buildSchemes();
    this._wire();
    if (this.opts.studio) this._enableStudio();
  };

  /* ------------------------------------------------------------- chrome */

  Viz.prototype._buildScenes = function () {
    var self = this, box = this.$.scenes;
    box.innerHTML = '';
    this.scenes.concat(this.customScenes).forEach(function (sc) {
      var b = el('button', 'pv-scene' + (sc.id === self.state.sceneId ? ' is-on' : ''), esc(sc.name));
      b.onclick = function () { self.loadScene(sc.id); };
      box.appendChild(b);
    });
    var up = el('button', 'pv-scene pv-scene-upload', '&#43; Use my photo');
    up.onclick = function () { self._pickPhoto(); };
    box.appendChild(up);
  };

  Viz.prototype._buildCollections = function () {
    var self = this, box = this.$.collections;
    box.innerHTML = '';
    this.palette.collections.forEach(function (col, i) {
      var b = el('button', 'pv-col' + (i === 0 ? ' is-on' : ''), esc(col.name));
      b.onclick = function () {
        box.querySelectorAll('.pv-col').forEach(function (n) { n.classList.remove('is-on'); });
        b.classList.add('is-on');
        self.$.search.value = '';
        self._renderSwatches(col.id);
      };
      box.appendChild(b);
    });
    this._renderSwatches(this.palette.collections[0].id);
  };

  Viz.prototype._renderSwatches = function (collectionId, query) {
    var self = this, box = this.$.swatches;
    if (collectionId) this._activeCollection = collectionId;
    var list;
    if (query) {
      var q = query.toLowerCase();
      list = PaintViz.paletteIndex(this.palette).filter(function (c) {
        return c.name.toLowerCase().indexOf(q) >= 0 || (c.code || '').toLowerCase().indexOf(q) >= 0 ||
               (c.brand || '').toLowerCase().indexOf(q) >= 0;
      });
    } else {
      var col = this.palette.collections.filter(function (c) { return c.id === collectionId; })[0];
      list = col ? col.colors : [];
    }
    box.innerHTML = '';
    if (!list.length) { box.appendChild(el('p', 'pv-note', 'No colors match that search.')); return; }
    list.forEach(function (c) {
      var b = el('button', 'pv-sw');
      b.style.background = c.hex;
      b.style.color = C.inkOn(c.hex);
      b.title = c.name + ' · ' + (c.code || '') + ' · LRV ' + C.lrv(c.hex);
      b.innerHTML = '<span class="pv-sw-name">' + esc(c.name) + '</span>' +
                    '<span class="pv-sw-meta">' + esc(c.code || '') + ' · LRV ' + C.lrv(c.hex) + '</span>';
      b.onclick = function () { self.applyColor(c.hex, c); };
      box.appendChild(b);
    });
  };

  Viz.prototype._buildSheens = function () {
    var self = this, box = this.$.sheens;
    box.innerHTML = '';
    Object.keys(PaintViz.SHEENS).forEach(function (k) {
      var b = el('button', 'pv-sheen', esc(PaintViz.SHEENS[k].label));
      b.dataset.sheen = k;
      b.onclick = function () {
        var s = self._sel(); if (!s) return;
        self._push();
        s.sheen = k;
        self._syncSheens(); self.render();
      };
      box.appendChild(b);
    });
  };

  Viz.prototype._buildSchemes = function () {
    var self = this, box = this.$.schemes;
    box.innerHTML = '';
    this.palette.schemes.forEach(function (sch) {
      var b = el('button', 'pv-scheme');
      var chips = Object.keys(sch.roles).slice(0, 5).map(function (rk) {
        return '<i style="background:' + sch.roles[rk] + '"></i>';
      }).join('');
      b.innerHTML = '<span class="pv-scheme-chips">' + chips + '</span><span>' + esc(sch.name) + '</span>';
      b.onclick = function () { self.applyScheme(sch); };
      box.appendChild(b);
    });
  };

  /* ------------------------------------------------------------- scenes */

  Viz.prototype.loadScene = function (id, restore) {
    var self = this;
    var sc = this.scenes.concat(this.customScenes).filter(function (s) { return s.id === id; })[0];
    if (!sc) return;
    this.state.sceneId = id;
    this.state.selected = null;
    this.state.history = [];
    this.$.loading.hidden = false;
    this._buildScenes();

    var go = function (img, regions) {
      self._install(img, regions, sc);
      if (restore && restore.picks) self._restore(restore.picks);
      self.$.loading.hidden = true;
    };

    // yield a frame so the loading state paints before we block on scene build
    setTimeout(function () {
      if (sc.type === 'demo') {
        var built = sc.build();
        go(built.canvas, built.regions);
      } else if (sc.type === 'photo' && sc._img) {
        go(sc._img, sc.regions);
      } else if (sc.type === 'url') {
        self._loadUrlScene(sc, go);
      }
    }, 16);
  };

  /** A scene defined by a photo URL plus mask PNG URLs. */
  Viz.prototype._loadUrlScene = function (sc, done) {
    var img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = function () {
      var scale = Math.min(1, MAX_EDGE / Math.max(img.width, img.height));
      var w = Math.round(img.width * scale), h = Math.round(img.height * scale);
      var cv = document.createElement('canvas'); cv.width = w; cv.height = h;
      cv.getContext('2d').drawImage(img, 0, 0, w, h);
      Promise.all((sc.regions || []).map(function (r) {
        return MK.load(r.mask, w, h).then(function (m) {
          return { id: r.id, name: r.name, role: r.role, sheen: r.sheen, mask: m };
        });
      })).then(function (regions) { done(cv, regions); })
        .catch(function (e) { console.error('[PaintViz]', e); done(cv, []); });
    };
    img.onerror = function () { console.error('[PaintViz] scene image failed:', sc.image); };
    img.src = sc.image;
  };

  Viz.prototype._install = function (source, regions, sc) {
    var w = source.width, h = source.height;
    this.w = w; this.h = h;
    [this.$.painted, this.$.original, this.$.hover].forEach(function (c) { c.width = w; c.height = h; });
    this.ctxOriginal.drawImage(source, 0, 0);
    var base = this.ctxOriginal.getImageData(0, 0, w, h);
    this.baseImage = base;

    this.comp = new PaintViz.Compositor(base);
    var self = this;
    (regions || []).forEach(function (r) {
      var s = new PaintViz.Surface(r.id, base.data, r.mask, w, h, {
        name: r.name, sheen: r.sheen || 'satin', color: null
      });
      s.role = r.role || inferRole(r.id, r.name);
      self.comp.addSurface(s);
    });
    this.analysis = null; // built lazily, only if the visitor edits a mask
    this._renderSurfaces();
    this._setHint(regions && regions.length
      ? 'Tap a surface on the image, then pick a color.'
      : 'Tap the wall or siding in your photo to select it.');
    this.render();
    if (this.comp.surfaces.length) this.select(this.comp.surfaces[0].id);
  };

  /* ------------------------------------------------------- surface list */

  Viz.prototype._renderSurfaces = function () {
    var self = this, box = this.$.surfaces;
    box.innerHTML = '';
    if (!this.comp || !this.comp.surfaces.length) {
      box.appendChild(el('p', 'pv-note', 'No surfaces defined yet. Tap the image to select one.'));
      return;
    }
    this.comp.surfaces.forEach(function (s) {
      var row = el('button', 'pv-surface' + (self.state.selected === s.id ? ' is-on' : ''));
      row.innerHTML =
        '<i class="pv-surface-chip" style="background:' + (s.color || 'transparent') +
          (s.color ? '' : ';background-image:repeating-linear-gradient(45deg,#0002 0 6px,#0000 6px 12px)') + '"></i>' +
        '<span class="pv-surface-name">' + esc(s.name) + '</span>' +
        '<span class="pv-surface-val">' + (s.color ? esc(s._label || s.color.toUpperCase()) : 'Original') + '</span>';
      row.onclick = function () { self.select(s.id); };
      box.appendChild(row);
    });
  };

  Viz.prototype._sel = function () { return this.comp && this.state.selected ? this.comp.get(this.state.selected) : null; };

  Viz.prototype.select = function (id) {
    this.state.selected = id;
    var s = this._sel();
    this.$.forsurf.textContent = s ? 'for ' + s.name : '';
    this._renderSurfaces();
    this._syncSheens();
    this._drawHover(s);
  };

  Viz.prototype._syncSheens = function () {
    var s = this._sel();
    this.$.sheens.querySelectorAll('.pv-sheen').forEach(function (b) {
      b.classList.toggle('is-on', !!s && b.dataset.sheen === s.sheen);
    });
  };

  /* -------------------------------------------------------------- paint */

  Viz.prototype._push = function () {
    if (!this.comp) return;
    this.state.history.push(this.comp.surfaces.map(function (s) {
      return { id: s.id, color: s.color, sheen: s.sheen, label: s._label };
    }));
    if (this.state.history.length > 40) this.state.history.shift();
  };

  Viz.prototype.applyColor = function (hex, meta) {
    var s = this._sel();
    if (!s) { this._setHint('Pick a surface first — tap the image.'); return; }
    this._push();
    s.color = hex;
    s._label = meta && meta.name ? meta.name : hex.toUpperCase();
    s._code = meta && meta.code ? meta.code : '';
    this._renderSurfaces();
    this.render();
    this._writeUrl();
  };

  Viz.prototype.applyScheme = function (sch) {
    if (!this.comp) return;
    this._push();
    var idx = PaintViz.paletteIndex(this.palette);
    this.comp.surfaces.forEach(function (s) {
      var FALLBACK = {
        cabinetUpper: ['trim', 'body'], cabinetLower: ['body', 'accent'],
        island: ['accent', 'body'], shutter: ['accent', 'secondary', 'body'],
        garage: ['trim', 'body'], secondary: ['body'], wall: ['trim', 'body'],
        masonry: ['body'], trim: ['body'], accent: ['body']
      };
      var hex = sch.roles[s.role];
      var chain = FALLBACK[s.role] || [];
      for (var f = 0; !hex && f < chain.length; f++) hex = sch.roles[chain[f]];
      if (!hex) hex = sch.roles.body;
      s.color = hex;
      var m = idx.filter(function (c) { return c.hex.toLowerCase() === hex.toLowerCase(); })[0];
      s._label = m ? m.name : hex.toUpperCase();
      s._code = m ? m.code : '';
    });
    this._renderSurfaces();
    this.render();
    this._writeUrl();
  };

  Viz.prototype.render = function () {
    if (!this.comp) return;
    this.comp.drawTo(this.ctxPainted);
  };

  Viz.prototype.reset = function () {
    if (!this.comp) return;
    this._push();
    this.comp.surfaces.forEach(function (s) { s.color = null; s._label = null; });
    this._renderSurfaces();
    this.render();
    this._writeUrl();
  };

  Viz.prototype.undo = function () {
    var prev = this.state.history.pop();
    if (!prev || !this.comp) return;
    var self = this;
    prev.forEach(function (p) {
      var s = self.comp.get(p.id);
      if (s) { s.color = p.color; s.sheen = p.sheen; s._label = p.label; }
    });
    this._renderSurfaces(); this._syncSheens(); this.render(); this._writeUrl();
  };

  /* -------------------------------------------------------------- hover */

  Viz.prototype._drawHover = function (s) {
    this.ctxHover.clearRect(0, 0, this.w, this.h);
    if (!s) return;
    var o = this.comp.outline(s, '#ffffff');
    if (!o) return;
    this.ctxHover.globalAlpha = 0.95;
    this.ctxHover.drawImage(o, 0, 0);
    this.ctxHover.globalAlpha = 1;
  };

  Viz.prototype._setHint = function (t) {
    this.$.hint.textContent = t || '';
    this.$.hint.style.display = t ? '' : 'none';
  };

  Viz.prototype._pos = function (ev) {
    var rect = this.$.painted.getBoundingClientRect();
    var t = ev.touches && ev.touches[0] ? ev.touches[0] : ev;
    return {
      x: (t.clientX - rect.left) / rect.width * this.w,
      y: (t.clientY - rect.top) / rect.height * this.h
    };
  };

  /* --------------------------------------------------------------- wire */

  Viz.prototype._wire = function () {
    var self = this, $ = this.$;

    /** True when the event came from an overlay control, not the image itself.
     *  The photo toolbar sits inside the canvas wrapper, so without this its
     *  clicks bubble down here and get read as taps on the photo. */
    function onOverlay(e) {
      return !!(e.target && e.target.closest && e.target.closest('.pv-phototools'));
    }

    $.wrap.addEventListener('mousemove', function (e) {
      if (self._comparing || !self.comp || onOverlay(e)) return;
      var p = self._pos(e);
      var s = self.comp.surfaceAt(p.x, p.y);
      $.wrap.style.cursor = s ? 'pointer' : (self._photoMode ? 'crosshair' : 'default');
      if (s && s.id !== self.state.selected) self._drawHover(s);
      else if (!s) self._drawHover(self._sel());
    });
    $.wrap.addEventListener('mouseleave', function () { self._drawHover(self._sel()); });

    $.wrap.addEventListener('click', function (e) {
      if (self._comparing || !self.comp || onOverlay(e)) return;
      var p = self._pos(e);
      var s = self.comp.surfaceAt(p.x, p.y);
      if (s) { self.select(s.id); return; }
      if (self._photoMode) self._wandAt(p.x, p.y);
    });

    $.search.addEventListener('input', function () {
      var q = this.value.trim();
      // an emptied search box returns to the collection that was open, not to nothing
      if (q) self._renderSwatches(null, q);
      else self._renderSwatches(self._activeCollection);
    });
    $.custom.addEventListener('input', function () {
      self.applyColor(this.value, { name: 'Custom ' + this.value.toUpperCase() });
    });

    $.reset.onclick = function () { self.reset(); };
    $.download.onclick = function () { self.download(); };
    $.share.onclick = function () { self.copyLink(); };
    $.quote.onclick = function () { self.openQuote(); };

    // Before/after: press and drag anywhere on the image
    var dragging = false;
    function setDivider(e) {
      var rect = $.wrap.getBoundingClientRect();
      var t = e.touches && e.touches[0] ? e.touches[0] : e;
      var pct = Math.max(0, Math.min(100, (t.clientX - rect.left) / rect.width * 100));
      self.state.compare = pct;
      $.original.style.clipPath = 'inset(0 ' + (100 - pct) + '% 0 0)';
      $.divider.style.left = pct + '%';
    }
    function startCompare(e) {
      self._comparing = true; dragging = true;
      $.wrap.classList.add('is-comparing');
      $.hover.style.opacity = '0';
      setDivider(e); e.preventDefault();
    }
    function endCompare() {
      if (!dragging) return;
      dragging = false; self._comparing = false;
      $.wrap.classList.remove('is-comparing');
      $.original.style.clipPath = 'inset(0 100% 0 0)';
      $.hover.style.opacity = '';
    }
    $.compare.addEventListener('mousedown', startCompare);
    $.compare.addEventListener('touchstart', startCompare, { passive: false });
    window.addEventListener('mousemove', function (e) { if (dragging) setDivider(e); });
    window.addEventListener('touchmove', function (e) { if (dragging) { setDivider(e); e.preventDefault(); } }, { passive: false });
    window.addEventListener('mouseup', endCompare);
    window.addEventListener('touchend', endCompare);

    document.addEventListener('keydown', function (e) {
      if (!self.root.contains(document.activeElement) && document.activeElement !== document.body) return;
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); self.undo(); }
    });
  };


  /* ------------------------------------------------- visitor's own photo */

  Viz.prototype._pickPhoto = function () {
    var self = this;
    var inp = el('input');
    inp.type = 'file';
    inp.accept = 'image/*';
    inp.onchange = function () {
      var f = inp.files && inp.files[0];
      if (!f) return;
      if (!/^image\//.test(f.type)) { self._setHint('That file is not an image.'); return; }
      var url = URL.createObjectURL(f);
      var img = new Image();
      img.onload = function () {
        URL.revokeObjectURL(url);
        self._installPhoto(img, f.name);
      };
      img.onerror = function () {
        URL.revokeObjectURL(url);
        self._setHint('That image could not be opened.');
      };
      img.src = url;
    };
    inp.click();
  };

  Viz.prototype._installPhoto = function (img, name) {
    var scale = Math.min(1, MAX_EDGE / Math.max(img.width, img.height));
    var w = Math.round(img.width * scale), h = Math.round(img.height * scale);
    var cv = document.createElement('canvas');
    cv.width = w; cv.height = h;
    cv.getContext('2d').drawImage(img, 0, 0, w, h);

    var id = 'photo-' + Date.now();
    var sc = { id: id, name: (name || 'My photo').replace(/\.[^.]+$/, '').slice(0, 24), type: 'photo', _img: cv, regions: [] };
    this.customScenes.push(sc);
    this.state.sceneId = id;
    this._buildScenes();
    this._install(cv, [], sc);
    this._photoMode = true;
    this._nextSurfaceN = 1;
    this._tolerance = 50;
    this._showPhotoTools();
    this._setHint('Tap the siding, a wall, or a cabinet door to select it.');
  };

  /**
   * Wand from a tap. The visitor never sees the word "mask": they tap a surface,
   * and if it grabbed too much or too little they move one slider.
   */
  Viz.prototype._wandAt = function (x, y) {
    if (!this.analysis) {
      this.analysis = MK.analyze(this.baseImage.data, this.w, this.h);
    }
    var sid = 'sel-' + (this._nextSurfaceN++);
    var tol = this._tolerance;
    var raw = MK.wand(this.analysis, x, y, tol, true);

    /* Runaway guard. Where two surfaces are near the same color and meet with no
     * hard edge — white uppers against a white wall is the classic — the fill can
     * escape and swallow half the photo. Silently handing back that selection is
     * the worst outcome, so back the sensitivity off until it is plausible and
     * say so, rather than making the visitor undo it themselves. */
    var backedOff = 0;
    while (this._isLeaking(raw) && tol > 14 && backedOff < 5) {
      tol -= 8;
      raw = MK.wand(this.analysis, x, y, tol, true);
      backedOff++;
    }
    var stillLeaking = this._isLeaking(raw);
    if (backedOff) {
      this._tolerance = tol;
      var slider = this.root.querySelector('[data-pt="tol"]');
      if (slider) slider.value = tol;
    }

    if (MK.count(raw) < 200) {
      this._setHint('That spot is very small — try tapping a broad area, or raise the sensitivity.');
      this._nextSurfaceN--;
      return;
    }
    var s = this._addMaskSurface(sid, 'Surface ' + (this._nextSurfaceN - 1), raw);
    s._seed = { x: x, y: y };
    this.select(sid);
    this._showPhotoTools();
    this._setHint(
      stillLeaking
        ? 'These surfaces are too close in color to separate automatically. Lower Sensitivity, then use Add and Remove to shape it.'
        : backedOff
          ? 'That selection was spilling over, so sensitivity was lowered. Use Add to extend it.'
          : '');
  };

  /**
   * Has the fill escaped the surface?
   *
   * One paintable surface rarely covers more than about 40% of a photo — you can
   * normally also see roof, sky, ground, or counters and floor. Past that, the
   * fill has almost certainly run through a weak boundary into its neighbour.
   *
   * Measured stability (does the selection collapse when tolerance drops?) was
   * tried here and does not work: where two surfaces are genuinely inseparable by
   * color — white uppers meeting a white wall with only soft shading between them
   * — the fill leaks at *every* tolerance, so it looks perfectly stable while
   * being completely wrong. Area is the blunt but honest test.
   */
  Viz.prototype.LEAK_FRACTION = 0.40;

  Viz.prototype._isLeaking = function (raw) {
    return MK.count(raw) / (this.w * this.h) > this.LEAK_FRACTION;
  };

  /** Build (or rebuild) a Surface from a raw hard mask, applying the refinements
   *  that keep a repaint from fringing: drop specks, pull back one pixel off the
   *  boundary, then feather. */
  Viz.prototype._addMaskSurface = function (id, name, raw, keep) {
    var m = Uint8Array.from(raw);
    MK.despeckle(m, this.w, this.h, 40);
    MK.expand(m, this.w, this.h, -1);
    MK.feather(m, this.w, this.h, 1.5);

    var old = this.comp.get(id);
    var carry = keep || (old ? { color: old.color, sheen: old.sheen, label: old._label, code: old._code, role: old.role, name: old.name, seed: old._seed } : null);
    if (old) this.comp.removeSurface(id);

    var s = new PaintViz.Surface(id, this.baseImage.data, m, this.w, this.h, {
      name: (carry && carry.name) || name,
      sheen: (carry && carry.sheen) || 'satin',
      color: carry ? carry.color : null
    });
    s._label = carry ? carry.label : null;
    s._code = carry ? carry.code : '';
    s._mask = m;
    s._rawMask = raw;
    s._seed = carry ? carry.seed : null;
    s.role = (carry && carry.role) || 'body';
    this.comp.addSurface(s);
    this._renderSurfaces();
    this.render();
    this._drawHover(s);
    return s;
  };

  /** Floating toolbar for tuning a selection on an uploaded photo. */
  Viz.prototype._showPhotoTools = function () {
    var self = this;
    var s = this._sel();
    var old = this.root.querySelector('.pv-phototools');
    if (old) old.remove();
    if (!this._photoMode) return;

    var bar = el('div', 'pv-phototools');
    if (!s) {
      bar.innerHTML = '<span class="pv-pt-msg">Tap a surface in the photo to select it.</span>';
      this.$.wrap.appendChild(bar);
      return;
    }
    bar.innerHTML =
      '<label class="pv-pt-row"><span>Sensitivity</span>' +
        '<input type="range" min="8" max="85" value="' + this._tolerance + '" data-pt="tol">' +
      '</label>' +
      '<div class="pv-pt-row pv-pt-btns">' +
        '<button data-pt="add" class="pv-pt-btn" title="Paint over anything the selection missed">Add</button>' +
        '<button data-pt="sub" class="pv-pt-btn" title="Paint over anything it grabbed by mistake">Remove</button>' +
        '<input type="range" min="6" max="90" value="26" data-pt="brush" title="Brush size">' +
      '</div>' +
      '<div class="pv-pt-row pv-pt-btns">' +
        '<button data-pt="rename" class="pv-pt-btn">Rename</button>' +
        '<button data-pt="del" class="pv-pt-btn">Delete</button>' +
        '<button data-pt="done" class="pv-pt-btn pv-pt-done">Done</button>' +
      '</div>';
    this.$.wrap.appendChild(bar);

    var q = function (n) { return bar.querySelector('[data-pt="' + n + '"]'); };

    q('tol').addEventListener('change', function () {
      var cur = self._sel();
      if (!cur || !cur._seed) return;
      self._tolerance = +this.value;
      var raw = MK.wand(self.analysis, cur._seed.x, cur._seed.y, self._tolerance, true);
      self._addMaskSurface(cur.id, cur.name, raw);
      self.select(cur.id);
    });

    ['add', 'sub'].forEach(function (mode) {
      q(mode).onclick = function () {
        self._brushMode = self._brushMode === mode ? null : mode;
        bar.querySelectorAll('.pv-pt-btn').forEach(function (b) { b.classList.remove('is-on'); });
        if (self._brushMode) q(mode).classList.add('is-on');
        self.$.wrap.classList.toggle('is-brushing', !!self._brushMode);
        self._setHint(self._brushMode
          ? (mode === 'add' ? 'Drag over anything the selection missed.' : 'Drag over anything it grabbed by mistake.')
          : '');
      };
    });

    q('rename').onclick = function () {
      var cur = self._sel(); if (!cur) return;
      var n = prompt('Name this surface (e.g. Siding, Trim, Front Door):', cur.name);
      if (n) { cur.name = n.slice(0, 32); cur.role = inferRole(cur.id, cur.name); self._renderSurfaces(); self.select(cur.id); }
    };
    q('del').onclick = function () {
      var cur = self._sel(); if (!cur) return;
      self.comp.removeSurface(cur.id);
      self.state.selected = null;
      self._renderSurfaces(); self.render();
      self.ctxHover.clearRect(0, 0, self.w, self.h);
      self._showPhotoTools();
    };
    q('done').onclick = function () {
      self._photoMode = false;
      self._brushMode = null;
      self.$.wrap.classList.remove('is-brushing');
      bar.remove();
      self._setHint('');
    };

    this._wireBrush(q('brush'));
  };

  Viz.prototype._wireBrush = function (sizeInput) {
    var self = this, wrap = this.$.wrap, drawing = false, work = null;
    if (this._brushWired) return;
    this._brushWired = true;

    function radius() { return sizeInput ? +sizeInput.value : 26; }

    function begin(e) {
      if (!self._brushMode) return;
      if (e.target && e.target.closest && e.target.closest('.pv-phototools')) return;
      var s = self._sel(); if (!s) return;
      drawing = true;
      work = Uint8Array.from(s._rawMask || s._mask);
      stroke(e); e.preventDefault();
    }
    function stroke(e) {
      if (!drawing) return;
      var p = self._pos(e);
      MK.brush(work, self.w, self.h, p.x, p.y, radius(), 0.7, self._brushMode === 'sub' ? 'erase' : 'add');
      // live preview straight onto the hover layer — cheap, no surface rebuild
      var ctx = self.ctxHover;
      ctx.fillStyle = self._brushMode === 'sub' ? 'rgba(255,80,80,0.55)' : 'rgba(90,200,255,0.55)';
      ctx.beginPath(); ctx.arc(p.x, p.y, radius(), 0, 6.284); ctx.fill();
      e.preventDefault();
    }
    function end() {
      if (!drawing) return;
      drawing = false;
      var s = self._sel(); if (!s) return;
      var id = s.id;
      self._addMaskSurface(id, s.name, work);
      self.select(id);
    }
    wrap.addEventListener('mousedown', begin);
    wrap.addEventListener('touchstart', begin, { passive: false });
    window.addEventListener('mousemove', stroke);
    window.addEventListener('touchmove', stroke, { passive: false });
    window.addEventListener('mouseup', end);
    window.addEventListener('touchend', end);
  };

  /* ------------------------------------------------------ save / share */

  /** Flatten the current view, with an optional brand footer, to a PNG. */
  Viz.prototype.toCanvas = function (withBrand) {
    var pad = withBrand && this.brand.name ? 64 : 0;
    var out = document.createElement('canvas');
    out.width = this.w; out.height = this.h + pad;
    var c = out.getContext('2d');
    c.fillStyle = '#ffffff';
    c.fillRect(0, 0, out.width, out.height);
    c.drawImage(this.$.painted, 0, 0);
    if (pad) {
      c.fillStyle = '#141413';
      c.fillRect(0, this.h, this.w, pad);
      c.fillStyle = '#ffffff';
      c.font = '600 ' + Math.round(pad * 0.34) + 'px system-ui, sans-serif';
      c.textBaseline = 'middle';
      c.fillText(this.brand.name, 24, this.h + pad * 0.38);
      var sub = this.comp.surfaces.filter(function (s) { return s.color; })
        .map(function (s) { return s.name + ': ' + (s._label || s.color); }).join('   ·   ');
      c.font = Math.round(pad * 0.24) + 'px system-ui, sans-serif';
      c.fillStyle = 'rgba(255,255,255,0.72)';
      c.fillText(sub.slice(0, 130), 24, this.h + pad * 0.72);
    }
    return out;
  };

  Viz.prototype.download = function () {
    var self = this;
    var cv = this.toCanvas(true);
    cv.toBlob(function (blob) {
      if (!blob) return;
      var url = URL.createObjectURL(blob);
      var a = el('a');
      a.href = url;
      a.download = (self.brand.name ? self.brand.name.replace(/\W+/g, '-').toLowerCase() + '-' : '') + 'color-preview.png';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
      self._toast('Image saved.');
    }, 'image/png');
  };

  Viz.prototype._picks = function () {
    if (!this.comp) return [];
    return this.comp.surfaces.filter(function (s) { return s.color; }).map(function (s) {
      return { id: s.id, surface: s.name, color: s._label || s.color, hex: s.color, code: s._code || '', sheen: (PaintViz.SHEENS[s.sheen] || {}).label || s.sheen };
    });
  };

  Viz.prototype._writeUrl = function () {
    if (this.opts.updateUrl === false) return;
    var parts = this.comp.surfaces.filter(function (s) { return s.color; }).map(function (s) {
      return encodeURIComponent(s.id) + ':' + s.color.replace('#', '') + ':' + s.sheen;
    });
    var hash = 'pv=' + encodeURIComponent(this.state.sceneId) + (parts.length ? '&c=' + parts.join(',') : '');
    try { history.replaceState(null, '', '#' + hash); } catch (e) { /* sandboxed iframe */ }
  };

  Viz.prototype._readUrl = function () {
    var h = (location.hash || '').replace(/^#/, '');
    if (h.indexOf('pv=') < 0) return null;
    var out = { picks: [] };
    h.split('&').forEach(function (kv) {
      var i = kv.indexOf('='), k = kv.slice(0, i), v = kv.slice(i + 1);
      if (k === 'pv') out.sceneId = decodeURIComponent(v);
      if (k === 'c') v.split(',').forEach(function (p) {
        var a = p.split(':');
        if (a.length >= 2) out.picks.push({ id: decodeURIComponent(a[0]), hex: '#' + a[1], sheen: a[2] });
      });
    });
    return out;
  };

  Viz.prototype._restore = function (picks) {
    var self = this, idx = PaintViz.paletteIndex(this.palette);
    picks.forEach(function (p) {
      var s = self.comp.get(p.id);
      if (!s || !C.parseHex(p.hex)) return;
      s.color = p.hex;
      if (p.sheen && PaintViz.SHEENS[p.sheen]) s.sheen = p.sheen;
      var m = idx.filter(function (c) { return c.hex.toLowerCase() === p.hex.toLowerCase(); })[0];
      s._label = m ? m.name : p.hex.toUpperCase();
      s._code = m ? m.code : '';
    });
    this._renderSurfaces(); this._syncSheens(); this.render();
  };

  Viz.prototype.copyLink = function () {
    this._writeUrl();
    var url = location.href;
    var self = this;
    var done = function () { self._toast('Link copied — send it to us or a friend.'); };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(done, function () { self._prompt(url); });
    } else this._prompt(url);
  };

  Viz.prototype._prompt = function (text) {
    window.prompt('Copy this link:', text);
  };

  Viz.prototype._toast = function (msg) {
    var t = el('div', 'pv-toast', esc(msg));
    this.root.appendChild(t);
    setTimeout(function () { t.classList.add('is-out'); }, 1900);
    setTimeout(function () { t.remove(); }, 2400);
  };

  /* -------------------------------------------------------------- quote */

  Viz.prototype.openQuote = function () {
    var self = this, picks = this._picks();
    var rows = picks.length
      ? picks.map(function (p) {
          return '<li><i style="background:' + p.hex + '"></i><b>' + esc(p.surface) + '</b> — ' +
                 esc(p.color) + (p.code ? ' <span class="pv-note">(' + esc(p.code) + ')</span>' : '') +
                 ' <span class="pv-note">' + esc(p.sheen) + '</span></li>';
        }).join('')
      : '<li class="pv-note">No colors selected yet.</li>';

    this.$.modalinner.innerHTML =
      '<button class="pv-modal-x" data-q="x" aria-label="Close">&times;</button>' +
      '<h3>Get a quote with these colors</h3>' +
      '<ul class="pv-picklist">' + rows + '</ul>' +
      '<form class="pv-form" data-q="form">' +
        '<label>Name<input name="name" required autocomplete="name"></label>' +
        '<label>Email<input name="email" type="email" required autocomplete="email"></label>' +
        '<label>Phone<input name="phone" type="tel" autocomplete="tel"></label>' +
        '<label>Property address<input name="address" autocomplete="street-address"></label>' +
        '<label>Anything else?<textarea name="message" rows="3"></textarea></label>' +
        '<button type="submit" class="pv-cta">Send my color selections</button>' +
        '<p class="pv-note" data-q="status"></p>' +
      '</form>';
    this.$.modal.hidden = false;

    var inner = this.$.modalinner;
    inner.querySelector('[data-q="x"]').onclick = function () { self.$.modal.hidden = true; };
    this.$.modal.onclick = function (e) { if (e.target === self.$.modal) self.$.modal.hidden = true; };

    inner.querySelector('[data-q="form"]').onsubmit = function (e) {
      e.preventDefault();
      var fd = new FormData(this), data = {};
      fd.forEach(function (v, k) { data[k] = String(v).slice(0, 2000); });
      data.selections = picks;
      data.scene = self.state.sceneId;
      data.link = location.href;
      self._submitLead(data, inner.querySelector('[data-q="status"]'));
    };
  };

  Viz.prototype._summaryText = function (data) {
    var lines = ['Color selections from the visualizer:', ''];
    (data.selections || []).forEach(function (p) {
      lines.push('- ' + p.surface + ': ' + p.color + (p.code ? ' (' + p.code + ')' : '') + ', ' + p.sheen + ' [' + p.hex + ']');
    });
    lines.push('', 'Name: ' + (data.name || ''), 'Email: ' + (data.email || ''), 'Phone: ' + (data.phone || ''),
               'Address: ' + (data.address || ''), '', 'Notes: ' + (data.message || ''), '', 'Preview link: ' + data.link);
    return lines.join('\n');
  };

  Viz.prototype._submitLead = function (data, statusEl) {
    var self = this, lead = this.opts.lead || {};
    var say = function (m) { if (statusEl) statusEl.textContent = m; };

    if (lead.endpoint) {
      say('Sending…');
      if (lead.includeImage !== false) {
        try { data.image = this.toCanvas(true).toDataURL('image/jpeg', 0.82); } catch (e) { /* tainted canvas */ }
      }
      fetch(lead.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      }).then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        say('Thanks — we have your selections and will be in touch.');
        self._toast('Sent.');
      }).catch(function (err) {
        console.error('[PaintViz] lead submit failed', err);
        say('That did not go through. Please call us, or copy your selections below.');
        self._fallback(data);
      });
      return;
    }

    if (lead.email) {
      var body = encodeURIComponent(this._summaryText(data));
      var subj = encodeURIComponent('Color selections from the website visualizer');
      location.href = 'mailto:' + lead.email + '?subject=' + subj + '&body=' + body;
      say('Opening your email app…');
      return;
    }

    say('No destination is configured yet — copy your selections below and send them over.');
    this._fallback(data);
  };

  Viz.prototype._fallback = function (data) {
    var box = el('textarea', 'pv-fallback');
    box.value = this._summaryText(data);
    box.readOnly = true;
    this.$.modalinner.appendChild(box);
    box.focus(); box.select();
  };


  /* ------------------------------------------------------------- studio */

  /**
   * Write the current photo and its masks out as ONE self-contained scene file.
   * Everything is embedded as data URIs so there is a single file to drop into
   * scenes/ — no matching up loose mask PNGs by filename, which is exactly the
   * step a non-technical user gets wrong.
   */
  Viz.prototype.exportScene = function () {
    if (!this.comp || !this.comp.surfaces.length) {
      this._toast('Select at least one surface first.');
      return null;
    }
    var self = this;
    var name = prompt('Name this scene (shown to visitors):', 'Job photo');
    if (name === null) return null;

    var jpeg = document.createElement('canvas');
    jpeg.width = this.w; jpeg.height = this.h;
    jpeg.getContext('2d').drawImage(this.$.original, 0, 0);

    var scene = {
      id: 'scene-' + Date.now().toString(36),
      name: name || 'Job photo',
      width: this.w,
      height: this.h,
      image: jpeg.toDataURL('image/jpeg', 0.86),
      regions: this.comp.surfaces.map(function (s) {
        return {
          id: s.id,
          name: s.name,
          role: s.role,
          sheen: s.sheen,
          mask: MK.toDataURL(s._mask || self._maskOf(s), self.w, self.h)
        };
      })
    };

    var blob = new Blob([JSON.stringify(scene, null, 2)], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = el('a');
    a.href = url;
    a.download = (scene.name.replace(/\W+/g, '-').toLowerCase() || 'scene') + '.json';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 4000);

    var mb = (blob.size / 1048576).toFixed(2);
    this._toast('Saved ' + a.download + ' (' + mb + ' MB) — drop it in scenes/');
    return scene;
  };

  /** Rebuild a coverage mask from a Surface that did not keep one (a scene
   *  loaded from disk carries its mask separately). */
  Viz.prototype._maskOf = function (s) {
    var m = new Uint8Array(this.w * this.h);
    for (var k = 0; k < s.count; k++) m[s.idx[k]] = Math.round(s.alpha[k] * 255);
    return m;
  };

  Viz.prototype._enableStudio = function () {
    var self = this;
    if (this.root.querySelector('[data-pv="export"]')) return;
    var b = el('button', 'pv-btn pv-btn-studio', 'Export Scene');
    b.setAttribute('data-pv', 'export');
    b.title = 'Save this photo and its surfaces as a scene file';
    b.onclick = function () { self.exportScene(); };
    this.$.tools.appendChild(b);

    var m = el('button', 'pv-btn', 'Edit Surfaces');
    m.title = 'Re-open the selection tools for this scene';
    m.onclick = function () {
      self._photoMode = true;
      if (!self._nextSurfaceN) self._nextSurfaceN = self.comp.surfaces.length + 1;
      if (!self._tolerance) self._tolerance = 50;
      self._showPhotoTools();
      self._setHint('Tap a new surface, or pick one and use Add / Remove.');
    };
    this.$.tools.appendChild(m);
  };

  PaintViz.Viz = Viz;

  /* -------------------------------------------------------------- mount */

  PaintViz.mount = function (target, opts) {
    var node = typeof target === 'string' ? document.querySelector(target) : target;
    if (!node) { console.error('[PaintViz] mount target not found:', target); return null; }
    var v = new Viz(node, opts);
    node._pv = v;   // so host pages (and tests) can reach the instance
    return v;
  };

  /** Auto-mount any <div data-paint-visualizer> on the page. */
  function auto() {
    document.querySelectorAll('[data-paint-visualizer]').forEach(function (n) {
      if (n._pv) return;
      var cfg = {};
      var raw = n.getAttribute('data-config');
      if (raw) { try { cfg = JSON.parse(raw); } catch (e) { console.warn('[PaintViz] bad data-config', e); } }
      n._pv = PaintViz.mount(n, cfg);
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', auto);
  else auto();
})(typeof window !== 'undefined' ? window : this);
