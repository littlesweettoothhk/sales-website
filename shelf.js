/*
  Little Sweet Tooth — "The Warm Bakery Shelf" behaviour.

  Four independent pieces, each a no-op when its markup is absent:

    · rails      — arrows, dot progress and "view all" for the mobile shelves
    · preview    — the detail panel / bottom sheet opened from a card
    · ribbon     — dot progress for the compact ordering ribbon
    · gallery    — the product-page photo gallery and its sticky order button

  Ordering is NOT reimplemented here. Every add / plus / minus control this
  file writes carries the same data-add / data-inc / data-dec / data-qty-for
  attributes order.js already listens for, so quantities, prices, the cart,
  the delivery progress and the WhatsApp hand-off all stay in order.js.
  window.LSTOrder.refresh() is called after markup is injected so the freshly
  built controls pick up the quantities already in the order.
*/
(function () {
  'use strict';

  var isZH = !/^en/i.test(document.documentElement.lang || '');
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var T = isZH ? {
    prev: '上一款', next: '下一款',
    close: '關閉', eyebrow: 'brookies ♥',
    goto: function (n) { return '去第 ' + n + ' 款'; },
    photo: function (n) { return '第 ' + n + ' 張相'; },
    step: function (n) { return '第 ' + n + ' 步'; }
  } : {
    prev: 'Previous', next: 'Next',
    close: 'Close', eyebrow: 'Brookies ♥',
    goto: function (n) { return 'Go to item ' + n; },
    photo: function (n) { return 'Photo ' + n; },
    step: function (n) { return 'Step ' + n; }
  };

  var SVG = {
    left:  '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M15 6l-6 6 6 6"/></svg>',
    right: '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>',
    down:  '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>',
    x:     '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>',
    plus:  '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
    minus: '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14"/></svg>'
  };

  function refreshOrder() {
    if (window.LSTOrder && window.LSTOrder.refresh) window.LSTOrder.refresh();
  }
  function addLabel() {
    return (window.LSTOrder && window.LSTOrder.addLabel) || (isZH ? '加入訂單' : 'Add to order');
  }

  /* the add button + stepper, exactly the shape order.js drives */
  function stepperHTML(id) {
    return '<div class="pc-add">' +
      '<button type="button" class="pc-add-btn" data-add="' + id + '">' +
        SVG.plus + '<span>' + addLabel() + '</span>' +
      '</button>' +
      '<div class="qty" data-qty-for="' + id + '" hidden>' +
        '<button type="button" class="qty-btn" data-dec="' + id + '" aria-label="−1">' + SVG.minus + '</button>' +
        '<span class="qty-n" aria-live="polite">0</span>' +
        '<button type="button" class="qty-btn" data-inc="' + id + '" aria-label="+1">' + SVG.plus + '</button>' +
      '</div></div>';
  }

  /* ════════════════════════════════════════════════════════════════
     1 · RAILS
     ════════════════════════════════════════════════════════════════ */

  function initShelf(shelf) {
    var grid = shelf.querySelector('.shelf-grid');
    var ui   = shelf.querySelector('.shelf-rail-ui');
    if (!grid || !ui) return;

    var cards = [].slice.call(grid.children);
    if (!cards.length) return;

    var prev = document.createElement('button');
    prev.type = 'button';
    prev.className = 'rail-btn rail-prev';
    prev.innerHTML = SVG.left;
    prev.setAttribute('aria-label', T.prev);

    var next = document.createElement('button');
    next.type = 'button';
    next.className = 'rail-btn rail-next';
    next.innerHTML = SVG.right;
    next.setAttribute('aria-label', T.next);

    var dots = document.createElement('div');
    dots.className = 'rail-dots';
    dots.setAttribute('role', 'tablist');
    cards.forEach(function (c, i) {
      var d = document.createElement('button');
      d.type = 'button';
      d.className = 'rail-dot' + (i === 0 ? ' on' : '');
      d.setAttribute('aria-label', T.goto(i + 1));
      d.addEventListener('click', function () { scrollToCard(i); });
      dots.appendChild(d);
    });

    ui.appendChild(prev);
    ui.appendChild(dots);
    ui.appendChild(next);

    // A card parked off the right-hand end of the rail is outside the VIEWPORT
    // too, so loading="lazy" defers it — and swiping the rail does not reliably
    // wake it, which left the last flavours as empty frames. Watch the rail
    // itself and promote each photo as it comes near.
    if ('IntersectionObserver' in window) {
      var near = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (!en.isIntersecting) return;
          if (en.target.loading === 'lazy') en.target.loading = 'eager';
          near.unobserve(en.target);
        });
      }, { root: grid, rootMargin: '0px 150% 0px 150%' });
      cards.forEach(function (c) {
        var im = c.querySelector('img');
        if (im) near.observe(im);
      });
    } else {
      cards.forEach(function (c) {
        var im = c.querySelector('img');
        if (im) im.loading = 'eager';
      });
    }

    function scrollToCard(i) {
      var c = cards[Math.max(0, Math.min(cards.length - 1, i))];
      grid.scrollTo({ left: c.offsetLeft - grid.offsetLeft, behavior: reduced ? 'auto' : 'smooth' });
    }
    function current() {
      // the card whose left edge is nearest the rail's scroll position
      var x = grid.scrollLeft, best = 0, dist = Infinity;
      cards.forEach(function (c, i) {
        var d = Math.abs((c.offsetLeft - grid.offsetLeft) - x);
        if (d < dist) { dist = d; best = i; }
      });
      return best;
    }
    function sync() {
      var i = current();
      var maxScroll = grid.scrollWidth - grid.clientWidth;
      [].forEach.call(dots.children, function (d, j) { d.classList.toggle('on', j === i); });
      prev.disabled = grid.scrollLeft <= 2;
      next.disabled = grid.scrollLeft >= maxScroll - 2;
    }

    prev.addEventListener('click', function () { scrollToCard(current() - 1); });
    next.addEventListener('click', function () { scrollToCard(current() + 1); });
    grid.addEventListener('scroll', function () {
      window.clearTimeout(grid._t);
      grid._t = window.setTimeout(sync, 60);
    }, { passive: true });
    window.addEventListener('resize', sync);
    sync();

    // "view all flavours" unrolls the rail so nothing stays hidden
    var all = shelf.querySelector('.view-all');
    if (all) {
      all.addEventListener('click', function (e) {
        e.preventDefault();
        var open = shelf.getAttribute('data-view') === 'all';
        shelf.setAttribute('data-view', open ? 'rail' : 'all');
        all.setAttribute('aria-expanded', open ? 'false' : 'true');
        if (open) { grid.scrollLeft = 0; sync(); }
      });
    }
  }

  /* ════════════════════════════════════════════════════════════════
     2 · PREVIEW SHEET
     ════════════════════════════════════════════════════════════════ */

  var pv, pvBack, pvLast = null;

  function buildPreview() {
    if (pv) return;
    pvBack = document.createElement('div');
    pvBack.className = 'pv-backdrop';

    pv = document.createElement('div');
    pv.className = 'pv';
    pv.setAttribute('role', 'dialog');
    pv.setAttribute('aria-modal', 'true');
    pv.innerHTML =
      '<div class="pv-media">' +
        '<span class="pv-handle" aria-hidden="true"></span>' +
        '<img alt="" decoding="async">' +
        '<button type="button" class="pv-close" aria-label="' + T.close + '">' + SVG.x + '</button>' +
      '</div>' +
      '<div class="pv-info">' +
        '<span class="pv-eyebrow">' + T.eyebrow + '</span>' +
        '<h2 class="pv-name"></h2>' +
        '<div class="pv-sub"></div>' +
        '<p class="pv-desc"></p>' +
        '<div class="pv-price"><span class="sc-lbl"></span><span class="sc-val"></span></div>' +
        '<div class="pv-order"></div>' +
        '<a class="pv-full" href="#"></a>' +
      '</div>';

    document.body.appendChild(pvBack);
    document.body.appendChild(pv);

    pvBack.addEventListener('click', closePreview);
    pv.querySelector('.pv-close').addEventListener('click', closePreview);
  }

  function openPreview(card) {
    buildPreview();
    var d = card.dataset;
    pvLast = card.querySelector('.sc-open') || card;

    var img = pv.querySelector('.pv-media img');
    img.src = d.img;
    img.alt = d.name;

    pv.querySelector('.pv-name').textContent = d.name;
    pv.querySelector('.pv-sub').textContent  = d.sub || '';
    pv.querySelector('.pv-desc').textContent = d.desc || '';
    pv.querySelector('.pv-price .sc-lbl').textContent = d.priceLabel || '';
    pv.querySelector('.pv-price .sc-val').textContent = d.priceText || ('$' + d.price);

    var full = pv.querySelector('.pv-full');
    full.href = d.url;
    full.textContent = d.more || '';
    full.hidden = !d.more;

    // carry the flavour tag across, if the card has one
    var oldTag = pv.querySelector('.pv-media .sc-tag');
    if (oldTag) oldTag.remove();
    var tag = card.querySelector('.sc-tag');
    if (tag) pv.querySelector('.pv-media').appendChild(tag.cloneNode(true));

    // the panel IS a product as far as order.js is concerned
    pv.setAttribute('data-product', '');
    pv.setAttribute('data-id', d.id);
    pv.querySelector('.pv-order').innerHTML = stepperHTML(d.id);
    refreshOrder();

    pv.setAttribute('aria-label', d.name);
    document.body.classList.add('pv-open');
    pvBack.classList.add('open');
    pv.classList.add('open');
    document.addEventListener('keydown', onPvKey);
    window.setTimeout(function () {
      var f = pv.querySelector('.pc-add-btn:not([hidden]), .qty-btn, .pv-close');
      if (f) f.focus();
    }, 60);
  }

  function closePreview() {
    if (!pv) return;
    pv.classList.remove('open');
    pvBack.classList.remove('open');
    document.body.classList.remove('pv-open');
    pv.removeAttribute('data-product');
    pv.removeAttribute('data-id');
    document.removeEventListener('keydown', onPvKey);
    if (pvLast && pvLast.focus) pvLast.focus();
  }

  function onPvKey(e) {
    if (e.key === 'Escape') { closePreview(); return; }
    if (e.key !== 'Tab') return;
    var f = pv.querySelectorAll('a[href]:not([hidden]), button:not([disabled]):not([hidden])');
    if (!f.length) return;
    var first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }

  /* ════════════════════════════════════════════════════════════════
     3 · RIBBON DOTS
     ════════════════════════════════════════════════════════════════ */

  function initRibbon(rb) {
    var steps = [].slice.call(rb.querySelectorAll('.rb-step'));
    if (steps.length < 2) return;
    var dots = document.createElement('div');
    dots.className = 'ribbon-dots';
    steps.forEach(function (s, i) {
      var d = document.createElement('button');
      d.type = 'button';
      d.className = 'rail-dot' + (i === 0 ? ' on' : '');
      d.setAttribute('aria-label', T.step(i + 1));
      d.addEventListener('click', function () {
        rb.scrollTo({ left: s.offsetLeft - rb.offsetLeft, behavior: reduced ? 'auto' : 'smooth' });
      });
      dots.appendChild(d);
    });
    rb.parentNode.insertBefore(dots, rb.nextSibling);

    rb.addEventListener('scroll', function () {
      window.clearTimeout(rb._t);
      rb._t = window.setTimeout(function () {
        var x = rb.scrollLeft, best = 0, dist = Infinity;
        steps.forEach(function (s, i) {
          var dd = Math.abs((s.offsetLeft - rb.offsetLeft) - x);
          if (dd < dist) { dist = dd; best = i; }
        });
        [].forEach.call(dots.children, function (d, j) { d.classList.toggle('on', j === best); });
      }, 60);
    }, { passive: true });
  }

  /* ════════════════════════════════════════════════════════════════
     4 · PRODUCT-PAGE GALLERY + STICKY ORDER BUTTON
     ════════════════════════════════════════════════════════════════ */

  function initGallery(g) {
    var track = g.querySelector('.pd-track');
    var slides = track ? [].slice.call(track.children) : [];
    if (!track) return;

    if (slides.length < 2) { g.setAttribute('data-single', ''); return; }

    var stage = g.querySelector('.pd-stage');
    var prev = document.createElement('button');
    prev.type = 'button'; prev.className = 'pd-arrow prev';
    prev.innerHTML = SVG.left; prev.setAttribute('aria-label', T.prev);
    var next = document.createElement('button');
    next.type = 'button'; next.className = 'pd-arrow next';
    next.innerHTML = SVG.right; next.setAttribute('aria-label', T.next);
    stage.appendChild(prev); stage.appendChild(next);

    var dots = g.querySelector('.pd-dots');
    slides.forEach(function (s, i) {
      var d = document.createElement('button');
      d.type = 'button';
      d.className = 'rail-dot' + (i === 0 ? ' on' : '');
      d.setAttribute('aria-label', T.photo(i + 1));
      d.addEventListener('click', function () { go(i); });
      dots.appendChild(d);
    });

    function idx() {
      var x = track.scrollLeft, best = 0, dist = Infinity;
      slides.forEach(function (s, i) {
        var dd = Math.abs(s.offsetLeft - track.offsetLeft - x);
        if (dd < dist) { dist = dd; best = i; }
      });
      return best;
    }
    function go(i) {
      var s = slides[Math.max(0, Math.min(slides.length - 1, i))];
      track.scrollTo({ left: s.offsetLeft - track.offsetLeft, behavior: reduced ? 'auto' : 'smooth' });
    }
    function sync() {
      var i = idx();
      [].forEach.call(dots.children, function (d, j) { d.classList.toggle('on', j === i); });
      prev.disabled = i === 0;
      next.disabled = i === slides.length - 1;
    }
    prev.addEventListener('click', function () { go(idx() - 1); });
    next.addEventListener('click', function () { go(idx() + 1); });
    track.addEventListener('scroll', function () {
      window.clearTimeout(track._t);
      track._t = window.setTimeout(sync, 60);
    }, { passive: true });
    sync();
  }

  function initStickyOrder() {
    var bar = document.querySelector('.pd-sticky');
    var anchor = document.querySelector('.pd-order');
    if (!bar || !anchor) return;

    var id = bar.getAttribute('data-id');
    var act = bar.querySelector('.pds-act');
    if (act && id) { act.innerHTML = stepperHTML(id); refreshOrder(); }

    var inView = true;
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (en) {
        inView = en[0].isIntersecting;
        update();
      }, { rootMargin: '0px 0px -40px 0px' }).observe(anchor);
    }
    function update() {
      // the global order bar owns the bottom of the screen once it appears
      var globalBar = document.getElementById('lstOrderBar');
      var globalShowing = globalBar && globalBar.classList.contains('show');
      bar.classList.toggle('show', !inView && !globalShowing);
    }
    update();
    window.addEventListener('scroll', update, { passive: true });
    document.addEventListener('click', function () { window.setTimeout(update, 30); });
  }

  /* ════════════════════════════════════════════════════════════════
     wiring
     ════════════════════════════════════════════════════════════════ */

  function init() {
    document.querySelectorAll('.shelf').forEach(initShelf);
    document.querySelectorAll('.ribbon').forEach(initRibbon);
    document.querySelectorAll('.pd-gallery').forEach(initGallery);
    initStickyOrder();

    // open the preview from a card
    document.addEventListener('click', function (e) {
      var open = e.target.closest('.sc-open');
      if (open) {
        var card = open.closest('[data-product]');
        if (card) { e.preventDefault(); openPreview(card); }
      }
    });

    // a quantity that changed gets a little pop — every stepper on the page
    document.addEventListener('click', function (e) {
      var t = e.target.closest('[data-add],[data-inc],[data-dec]');
      if (!t) return;
      var id = t.getAttribute('data-add') || t.getAttribute('data-inc') || t.getAttribute('data-dec');
      window.setTimeout(function () {
        document.querySelectorAll('[data-qty-for="' + id + '"] .qty-n').forEach(function (n) {
          n.classList.remove('bump');
          void n.offsetWidth;          // restart the animation
          n.classList.add('bump');
        });
      }, 0);
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
