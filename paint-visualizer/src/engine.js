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
