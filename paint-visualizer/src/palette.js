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
