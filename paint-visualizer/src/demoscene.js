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
