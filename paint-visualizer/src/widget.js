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
