/*
  Little Sweet Tooth — "Warm Editorial Patisserie Theatre", behaviour layer.

  Decoration only. Nothing here touches the catalogue, the shelf's scrolling,
  the preview panel, the cart or the WhatsApp hand-off; it reads the DOM the
  other scripts built and adds visual layers on top of it.

  Every piece is a no-op if its markup is absent, so the same file is safe on
  the home pages and the fourteen product pages.

  Budget: no framework, no canvas, no new image asset. Scroll and pointer
  work is throttled onto requestAnimationFrame, and everything animated is
  animated with transform and opacity.
*/
(function () {
  'use strict';

  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  function el(tag, cls, attrs) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (attrs) Object.keys(attrs).forEach(function (k) { n.setAttribute(k, attrs[k]); });
    return n;
  }
  function decorative(node) {
    node.setAttribute('aria-hidden', 'true');
    return node;
  }

  /* ── the hand-drawn marks, as inline SVG ────────────────────────── */
  var svg = function (body, vb) {
    return '<svg viewBox="' + (vb || '0 0 40 40') + '" fill="none" stroke="currentColor" ' +
           'stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" ' +
           'aria-hidden="true" focusable="false">' + body + '</svg>';
  };

  var MARKS = {
    heart:  svg('<path d="M20 33S6 24.5 6 15.5A7.5 7.5 0 0 1 20 12a7.5 7.5 0 0 1 14 3.5C34 24.5 20 33 20 33Z"/>'),
    flower: svg('<circle cx="20" cy="20" r="4"/><path d="M20 16c0-6 8-9 8-3s-8 3-8 3ZM20 24c0 6-8 9-8 3s8-3 8-3ZM16 20c-6 0-9-8-3-8s3 8 3 8ZM24 20c6 0 9 8 3 8s-3-8-3-8Z"/>'),
    cookie: svg('<circle cx="20" cy="20" r="12"/><circle cx="16" cy="17" r="1.6"/><circle cx="24" cy="21" r="1.6"/><circle cx="18" cy="25" r="1.4"/>'),
    swirl:  svg('<path d="M8 26c6-14 18-16 22-8 3 6-4 11-8 7-3-3 1-7 4-4"/>'),
    sparkle:svg('<path d="M20 6v10M20 24v10M6 20h10M24 20h10M11 11l6 6M23 23l6 6M29 11l-6 6M17 23l-6 6"/>')
  };

  /* flavour motifs — decorative only, they state nothing about the recipe */
  var MOTIFS = {
    seasalt:     svg('<path d="M4 46c8-6 14 6 22 0s14 6 22 0"/><path d="M10 30l3-6 3 6-3 6zM40 22l3-6 3 6-3 6z"/><circle cx="26" cy="20" r="5"/>', '0 0 64 64'),
    pepper:      svg('<path d="M12 50c6-18 16-28 30-32"/><path d="M24 34c-6-2-9-8-7-14 6-1 11 3 12 9"/><circle cx="44" cy="44" r="2.2"/><circle cx="52" cy="36" r="1.8"/><circle cx="38" cy="52" r="1.8"/>', '0 0 64 64'),
    caramel:     svg('<path d="M8 22c8-8 16 8 24 0s16 8 24 0"/><path d="M8 38c8-8 16 8 24 0s16 8 24 0"/><path d="M30 48c0 5 2 8 4 8"/>', '0 0 64 64'),
    marshmallow: svg('<path d="M12 42a8 8 0 0 1 1-16 11 11 0 0 1 21-2 8 8 0 0 1 5 15Z"/><circle cx="46" cy="48" r="4"/><circle cx="20" cy="52" r="2.6"/>', '0 0 64 64'),
    peanut:      svg('<path d="M22 14c8-4 16 2 14 10-1 5-6 6-6 12s6 8 4 14c-3 8-15 8-18 1-2-6 3-9 3-15s-4-8-3-14c1-4 3-6 6-8Z"/><path d="M24 30h10M24 42h10"/>', '0 0 64 64'),
    matcha:      svg('<path d="M10 50c14 2 26-8 30-24"/><path d="M22 42c-2-10 4-18 14-20 2 10-4 18-14 20Z"/><path d="M40 50c4-3 9-3 13 0"/>', '0 0 64 64'),
    hojicha:     svg('<circle cx="24" cy="40" r="10"/><circle cx="44" cy="46" r="6"/><path d="M22 20c4-3 0-7 4-10M32 20c4-3 0-7 4-10"/>', '0 0 64 64')
  };

  /* ════════════════════════════════════════════════════════════════
     1 · THE HERO ENTRANCE
     Five short beats. Everything is interactive from the first frame —
     the sequence only moves opacity and transform.
     ════════════════════════════════════════════════════════════════ */

  function hero() {
    var h = document.querySelector('.hero');
    if (!h) return;

    // the brand name, oversized and faint, behind the headline
    var brand = document.querySelector('.head-brand .bname');
    var copy = h.querySelector('.hero-copy');
    if (brand && copy && !copy.querySelector('.hero-ghost')) {
      // the ghost is wider than its column on purpose, so it sits in a band
      // that clips it rather than widening the page
      var band = decorative(el('span', 'hero-ghost-wrap'));
      var ghost = el('span', 'hero-ghost');
      ghost.textContent = brand.textContent.trim();
      band.appendChild(ghost);
      copy.insertBefore(band, copy.firstChild);
    }

    // the bounded stage the paper cut-outs live in
    var media = h.querySelector('.hero-media');
    if (media && !media.querySelector('.hero-cut')) {
      media.insertBefore(decorative(el('span', 'hero-cut')), media.firstChild);
    }

    // floating hand-drawn marks
    if (!h.querySelector('.hero-marks')) {
      var layer = decorative(el('div', 'hero-marks'));
      [['m1', 'heart'], ['m2', 'sparkle'], ['m3', 'flower'],
       ['m4', 'cookie'], ['m5', 'swirl']].forEach(function (p) {
        var m = el('span', 'hero-mark ' + p[0]);
        m.innerHTML = MARKS[p[1]];
        layer.appendChild(m);
      });
      h.appendChild(layer);
    }

    // start the sequence on the next frame so the first paint is the
    // "warm light" beat rather than a flash of finished layout
    requestAnimationFrame(function () {
      requestAnimationFrame(function () { h.classList.add('entered'); });
    });

    // pointer depth, desktop only, rAF-throttled
    if (fine && !reduced) {
      var px = 0, py = 0, queued = false;
      var apply = function () {
        queued = false;
        h.style.setProperty('--px', px.toFixed(3));
        h.style.setProperty('--py', py.toFixed(3));
      };
      h.addEventListener('pointermove', function (e) {
        if (e.pointerType !== 'mouse') return;
        var r = h.getBoundingClientRect();
        px = (e.clientX - r.left) / r.width * 2 - 1;
        py = (e.clientY - r.top) / r.height * 2 - 1;
        if (!queued) { queued = true; requestAnimationFrame(apply); }
      }, { passive: true });
      h.addEventListener('pointerleave', function () {
        px = 0; py = 0;
        if (!queued) { queued = true; requestAnimationFrame(apply); }
      });
    }
  }

  /* ════════════════════════════════════════════════════════════════
     2 · SECTION RHYTHM
     ════════════════════════════════════════════════════════════════ */

  function chapters() {
    document.querySelectorAll('.section-header').forEach(function (head) {
      var h2 = head.querySelector('h2');
      if (!h2 || head.querySelector('.sec-ghost')) return;
      // an oversized echo of the heading already on the page — no new words
      var g = decorative(el('span', 'sec-ghost'));
      g.textContent = h2.textContent.replace(/\s+/g, ' ').trim();
      head.insertBefore(g, head.firstChild);
    });

    // The closing signature is the line the footer already ends with — it is
    // given the stamp treatment rather than replaced or added to, so the page
    // gains no words it did not already have.
    var foot = document.querySelector('.foot-bottom');
    if (foot) {
      var last = foot.lastElementChild;
      if (last && /♥/.test(last.textContent) && !last.classList.contains('foot-stamp')) {
        last.classList.add('foot-stamp');
      }
    }
  }

  /* ════════════════════════════════════════════════════════════════
     3 · EDITORIAL POSTERS + FLAVOUR MOTIFS
     ════════════════════════════════════════════════════════════════ */

  function posters() {
    document.querySelectorAll('.sc[data-product]').forEach(function (card) {
      var id = card.getAttribute('data-id');
      var body = card.querySelector('.sc-body');
      var frame = card.querySelector('.sc-frame');

      // the oversized name is the English one, whichever field holds it
      if (body && !body.querySelector('.sc-poster')) {
        var name = card.getAttribute('data-name') || '';
        var sub = card.getAttribute('data-sub') || '';
        var latin = /^[\x20-\x7e]+$/;
        var word = latin.test(name.trim()) ? name : (latin.test(sub.trim()) ? sub : name);
        var p = decorative(el('span', 'sc-poster'));
        p.textContent = word;
        body.insertBefore(p, body.firstChild);
      }

      if (frame && MOTIFS[id] && !frame.querySelector('.sc-motif')) {
        var m = decorative(el('span', 'sc-motif'));
        m.innerHTML = MOTIFS[id];
        frame.appendChild(m);
      }
    });
  }

  /* ════════════════════════════════════════════════════════════════
     4 · FLAVOUR ATMOSPHERE
     The shelf takes its ambient light and its oversized word from the
     card nearest the start of the rail. Read-only: it listens to the
     rail's own scroll and never moves it.
     ════════════════════════════════════════════════════════════════ */

  function atmosphere() {
    document.querySelectorAll('.shelf').forEach(function (shelf) {
      var grid = shelf.querySelector('.shelf-grid');
      if (!grid) return;
      var cards = [].slice.call(grid.children);
      if (!cards.length) return;

      var word = decorative(el('div', 'shelf-word'));
      var span = el('span');
      word.appendChild(span);
      shelf.insertBefore(word, grid);

      var last = null, queued = false;

      function paint() {
        queued = false;
        var x = grid.scrollLeft, best = cards[0], dist = Infinity;
        cards.forEach(function (c) {
          var d = Math.abs((c.offsetLeft - grid.offsetLeft) - x);
          if (d < dist) { dist = d; best = c; }
        });
        if (best === last) return;
        last = best;

        cards.forEach(function (c) {
          c.classList.toggle('is-active', c === best);
          c.classList.toggle('is-quiet', c !== best);
        });

        var cs = getComputedStyle(best);
        shelf.style.setProperty('--fl-a', cs.getPropertyValue('--fl-a').trim());
        shelf.style.setProperty('--fl-b', cs.getPropertyValue('--fl-b').trim());

        var poster = best.querySelector('.sc-poster');
        var next = poster ? poster.textContent : '';
        if (span.textContent === next) return;
        if (reduced) { span.textContent = next; return; }
        word.classList.add('swap');
        window.setTimeout(function () {
          span.textContent = next;
          word.classList.remove('swap');
        }, 190);
      }

      grid.addEventListener('scroll', function () {
        if (!queued) { queued = true; requestAnimationFrame(paint); }
      }, { passive: true });
      window.addEventListener('resize', function () {
        if (!queued) { queued = true; requestAnimationFrame(paint); }
      });
      paint();
    });
  }

  /* ════════════════════════════════════════════════════════════════
     5 · ONE REVEAL LANGUAGE
     One observer for the page. Elements are visible and clickable from
     the first frame; only their offset animates.
     ════════════════════════════════════════════════════════════════ */

  /* Children of a horizontal rail can sit outside the viewport for as long
     as nobody swipes, so a viewport-rooted observer never fires for them and
     they would stay at opacity 0. These reveal as a group with their
     container instead. */
  var GROUPS = [['.ribbon', '.rb-step']];

  var RISE = [
    ['.section-header', 0],
    ['.menu-section-head', 0],
    ['.care-item', 1],
    ['.farewell-flavors', 0], ['.farewell-info', 1],
    ['.faq-item', 1],
    ['.contact-copy', 0], ['.contact-visual', 1],
    ['.foot-brand', 0], ['.foot-col', 1],
    ['.trust-item', 1],
    ['.qr-card', 0]
  ];

  function reveals() {
    if (!('IntersectionObserver' in window)) return;

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        en.target.classList.add('in');
        io.unobserve(en.target);
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });

    var groupIO = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        en.target.__kids.forEach(function (k) { k.classList.add('in'); });
        groupIO.unobserve(en.target);
      });
    }, { threshold: 0.05, rootMargin: '0px 0px -6% 0px' });

    GROUPS.forEach(function (pair) {
      document.querySelectorAll(pair[0]).forEach(function (box) {
        var kids = [].slice.call(box.querySelectorAll(pair[1]));
        if (!kids.length) return;
        kids.forEach(function (k, i) {
          k.classList.add('v2-rise');
          if (i) k.classList.add('d' + Math.min(3, i));
        });
        if (reduced) { kids.forEach(function (k) { k.classList.add('in'); }); return; }
        box.__kids = kids;
        groupIO.observe(box);
      });
    });

    RISE.forEach(function (pair) {
      document.querySelectorAll(pair[0]).forEach(function (node, i) {
        // the section header carries its own stamp animation, so it only
        // needs the `in` flag, not the offset
        if (!node.classList.contains('section-header')) {
          node.classList.add('v2-rise');
          if (pair[1] && i % 3) node.classList.add('d' + Math.min(3, i % 3 + 1));
        }
        if (reduced) { node.classList.add('in'); return; }
        io.observe(node);
      });
    });
  }

  /* ════════════════════════════════════════════════════════════════ */

  function init() {
    document.documentElement.classList.add('v2-ready');
    chapters();
    posters();
    hero();
    atmosphere();
    reveals();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
