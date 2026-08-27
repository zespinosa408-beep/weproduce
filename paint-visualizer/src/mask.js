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
