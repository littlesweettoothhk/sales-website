/*
  Little Sweet Tooth — how the pages move.

  Nothing here is needed to read the site or to order from it: the pages are
  complete HTML and order.js runs the ordering on its own. This file adds the
  stage that changes flavour, the things that respond to scrolling, the phone
  menu, and a few small courtesies. All of it stands down when the visitor has
  asked their device for reduced motion.
*/
(function () {
  'use strict';

  var doc = document, root = doc.documentElement, body = doc.body;
  var $ = function (s, c) { return (c || doc).querySelector(s); };
  var $$ = function (s, c) { return [].slice.call((c || doc).querySelectorAll(s)); };
  var calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  var clamp = function (v, a, b) { return Math.min(b, Math.max(a, v)); };

  // styles that hide things until they are revealed only apply once this is set
  root.classList.add('js');

  /* ───────────────────────── the bar at the top ───────────────────────── */

  var top = $('.top');
  var stage = $('.stage') || $('.pstage');
  var themeMeta = $('meta[name="theme-color"]');
  var CREAM = '#fdf5e2';

  // is the stage dark enough that the brown logo needs redrawing in cream?
  function setTone() {
    if (!top) return;
    var ink = getComputedStyle(body).getPropertyValue('--s-ink').trim();
    var m = /^#?([0-9a-f]{6})$/i.exec(ink);
    var light = false;
    if (m) {
      var n = parseInt(m[1], 16);
      light = (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) > 150;
    }
    top.classList.toggle('is-dark', light);
  }

  var lastY = window.scrollY, onStage = null;
  function syncTop() {
    if (!top) return;
    var y = window.scrollY;
    var over = !!stage && stage.getBoundingClientRect().bottom > top.offsetHeight;
    if (over !== onStage) {
      onStage = over;
      top.classList.toggle('on-stage', over);
      if (themeMeta) themeMeta.content = over ? getComputedStyle(body).getPropertyValue('--s-bg').trim() || CREAM : CREAM;
    }
    top.classList.toggle('is-stuck', y > 40);
    // out of the way while reading down, back the moment you scroll up
    var away = y > 560 && y > lastY + 4 && !body.classList.contains('sheet-open') && !top.contains(doc.activeElement);
    if (away) top.classList.add('is-away');
    else if (y < lastY - 4 || y < 560) top.classList.remove('is-away');
    lastY = y;
  }

  /* ───────────────────────── the phone menu ───────────────────────── */

  function initSheet() {
    var burger = $('.burger'), sheet = $('#sheet');
    if (!burger || !sheet) return;
    function set(open) {
      burger.setAttribute('aria-expanded', open ? 'true' : 'false');
      burger.setAttribute('aria-label', open ? burger.dataset.close : burger.dataset.open);
      body.classList.toggle('sheet-open', open);
      if (open) {
        sheet.hidden = false;
        // let the browser register it as shown before the opening transition
        requestAnimationFrame(function () { requestAnimationFrame(function () { sheet.classList.add('is-open'); }); });
        var first = $('a', sheet); if (first) first.focus({ preventScroll: true });
      } else {
        sheet.classList.remove('is-open');
        setTimeout(function () { if (!sheet.classList.contains('is-open')) sheet.hidden = true; }, calm ? 0 : 560);
      }
    }
    burger.addEventListener('click', function () { set(burger.getAttribute('aria-expanded') !== 'true'); });
    sheet.addEventListener('click', function (e) { if (e.target.closest('a')) set(false); });
    doc.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && burger.getAttribute('aria-expanded') === 'true') { set(false); burger.focus(); }
    });
    window.addEventListener('resize', function () { if (window.innerWidth > 1040 && body.classList.contains('sheet-open')) set(false); });
  }

  /* ───────────────────────── the order count in the bar ───────────────────────── */

  // order.js keeps its own count on the bar at the foot of the screen; mirror it
  function initBag() {
    var bag = $('.bag'), badge = $('.bag-n'), src = $('#lstOrderBar .ob-count');
    if (!bag || !badge || !src) return;
    var prev = null;
    function sync() {
      var n = parseInt(src.textContent, 10) || 0;
      badge.textContent = n;
      badge.hidden = n === 0;
      if (prev !== null && n > prev && !calm) { bag.classList.remove('bump'); void bag.offsetWidth; bag.classList.add('bump'); }
      prev = n;
    }
    new MutationObserver(sync).observe(src, { childList: true, characterData: true, subtree: true });
    sync();
  }

  /* ───────────────────────── the stage ───────────────────────── */

  var spin = 1;   // 1 for a brookie, 0 for a jar — a jar turned on its side looks dropped

  function initStage() {
    var el = $('.stage');
    if (!el) return;
    var tabs = $$('.pick', el), panels = $$('.sp', el);
    var shots = $('.stage-shots', el), word = $('.stage-word-track', el), list = $('.pick-list', el);
    if (!tabs.length || !shots) return;
    var current = Math.max(0, tabs.findIndex(function (t) { return t.classList.contains('is-on'); }));
    var auto = null, handsOn = false;

    function tall(t) { return +t.dataset.h > +t.dataset.w * 1.12; }
    function fillWord(text) {
      // six copies: two sets of three, so the track can loop on itself
      word.innerHTML = new Array(7).join('<span></span>');
      $$('span', word).forEach(function (s) { s.textContent = text; });
    }
    fillWord(tabs[current].dataset.word);
    spin = tall(tabs[current]) ? 0 : 1;

    function show(i) {
      i = (i + tabs.length) % tabs.length;
      if (i === current) return;
      var t = tabs[i], was = tabs[current];
      current = i;

      was.classList.remove('is-on'); was.setAttribute('aria-selected', 'false'); was.tabIndex = -1;
      t.classList.add('is-on'); t.setAttribute('aria-selected', 'true'); t.tabIndex = 0;
      panels.forEach(function (p) {
        var on = p.id === 'sp-' + t.dataset.id;
        p.hidden = !on; p.classList.toggle('is-on', on);
      });

      ['bg', 'ink', 'soft', 'deep'].forEach(function (k) { body.style.setProperty('--s-' + k, t.dataset[k]); });
      setTone();
      if (themeMeta && onStage) themeMeta.content = t.dataset.bg;

      // the old flavour spins out, the new one spins in
      $$('.shot', shots).forEach(function (old) {
        old.classList.remove('is-on'); old.classList.add('is-out');
        setTimeout(function () { old.remove(); }, calm ? 0 : 650);
      });
      var img = new Image();
      img.className = 'shot' + (t.hasAttribute('data-photo') ? ' is-photo' : '');
      img.alt = ''; img.width = t.dataset.w; img.height = t.dataset.h;
      img.src = t.dataset.cut;
      shots.appendChild(img);
      spin = tall(t) ? 0 : 1;
      var arrive = function () { requestAnimationFrame(function () { requestAnimationFrame(function () { img.classList.add('is-on'); }); }); };
      if (img.decode) img.decode().then(arrive, arrive); else arrive();

      word.classList.add('is-swapping');
      setTimeout(function () { fillWord(t.dataset.word); word.classList.remove('is-swapping'); }, calm ? 0 : 380);

      // keep the chosen thumbnail in view where the row scrolls
      if (list.scrollWidth > list.clientWidth) {
        list.scrollTo({ left: t.offsetLeft - (list.clientWidth - t.offsetWidth) / 2, behavior: calm ? 'auto' : 'smooth' });
      }
      warm(i + 1);
    }

    // fetch the next flavour's picture before it is asked for
    function warm(i) { var t = tabs[(i + tabs.length) % tabs.length]; if (t) { var im = new Image(); im.src = t.dataset.cut; } }

    function take() { handsOn = true; clearInterval(auto); }
    tabs.forEach(function (t, i) {
      t.addEventListener('click', function () { take(); show(i); });
    });
    list.addEventListener('keydown', function (e) {
      var to = e.key === 'ArrowRight' ? current + 1 : e.key === 'ArrowLeft' ? current - 1 :
               e.key === 'Home' ? 0 : e.key === 'End' ? tabs.length - 1 : null;
      if (to === null) return;
      e.preventDefault(); take(); show(to); tabs[current].focus();
    });
    $$('[data-stage]', el).forEach(function (b) {
      b.addEventListener('click', function () { take(); show(current + (b.dataset.stage === 'next' ? 1 : -1)); });
    });

    // a sideways swipe on the picture changes flavour
    var shotBox = $('.stage-shot', el), x0 = null, y0 = 0;
    shotBox.addEventListener('pointerdown', function (e) { x0 = e.clientX; y0 = e.clientY; });
    shotBox.addEventListener('pointerup', function (e) {
      if (x0 === null) return;
      var dx = e.clientX - x0, dy = e.clientY - y0; x0 = null;
      if (Math.abs(dx) > 44 && Math.abs(dx) > Math.abs(dy) * 1.4) { take(); show(current + (dx < 0 ? 1 : -1)); }
    });
    shotBox.addEventListener('pointercancel', function () { x0 = null; });

    // left alone, the stage walks through the flavours by itself
    if (!calm) {
      var inView = true;
      if ('IntersectionObserver' in window) {
        new IntersectionObserver(function (en) { inView = en[0].isIntersecting; }, { threshold: .35 }).observe(el);
      }
      auto = setInterval(function () {
        if (handsOn || !inView || doc.hidden || el.matches(':hover') || el.contains(doc.activeElement) ||
            body.classList.contains('cart-open') || body.classList.contains('sheet-open')) return;
        show(current + 1);
      }, 5200);
      setTimeout(function () { warm(current + 1); }, 1200);

      // the picture leans toward the pointer
      if (finePointer) {
        el.addEventListener('pointermove', function (e) {
          var r = el.getBoundingClientRect();
          var nx = (e.clientX - r.left) / r.width - .5, ny = (e.clientY - r.top) / r.height - .5;
          shots.style.setProperty('--px', (nx * 26).toFixed(1) + 'px');
          shots.style.setProperty('--py', (ny * 18).toFixed(1) + 'px');
          shots.dataset.lean = (nx * 10).toFixed(2);
        });
      }
    }
  }

  /* ───────────────────────── things tied to scrolling ───────────────────────── */

  var scrubbed = [];
  function initScrub() {
    if (calm) return;
    scrubbed = $$('[data-scrub]');
  }
  function scrub() {
    var vh = window.innerHeight;
    scrubbed.forEach(function (el) {
      var r = el.getBoundingClientRect();
      if (r.bottom < -200 || r.top > vh + 200) return;
      // "through": 0 as it enters at the foot of the screen, 1 as it leaves at the top
      // otherwise:  0 as it enters, 1 once its middle reaches the middle of the screen
      var p = el.classList.contains('fw-parade')
        ? (vh - r.top) / (vh + r.height)
        : (vh - r.top) / (vh / 2 + r.height / 2);
      el.style.setProperty('--p', clamp(p, 0, 1).toFixed(3));
    });
    // the flavour on stage turns as the page moves
    var rot = $('.stage-shots') || $('.pshot');
    if (rot && window.scrollY < 1400) {
      var lean = parseFloat(rot.dataset.lean || 0);
      rot.style.setProperty('--rot', (window.scrollY * .06 * spin + lean).toFixed(2) + 'deg');
    }
  }

  var ticking = false;
  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function () { syncTop(); if (!calm) scrub(); spy(); ticking = false; });
  }

  /* ───────────────────────── arriving as you scroll ───────────────────────── */

  function initReveal() {
    var items = $$('[data-reveal], .tile');
    if (calm || !('IntersectionObserver' in window)) { items.forEach(function (e) { e.classList.add('in'); }); return; }
    var io = new IntersectionObserver(function (entries) {
      // things that come into view together arrive one after another
      var n = 0;
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        var el = en.target;
        el.style.transitionDelay = (n++ * 80) + 'ms';
        el.classList.add('in');
        setTimeout(function () { el.style.transitionDelay = ''; }, 1100);
        io.unobserve(el);
      });
    }, { threshold: .12, rootMargin: '0px 0px -6% 0px' });
    items.forEach(function (e) { io.observe(e); });
  }

  /* ───────────────────────── which section the nav points at ───────────────────────── */

  var spyLinks = [], spyTargets = [], spyOn = null;
  function initSpy() {
    spyLinks = $$('.top-nav [data-nav]');
    spyTargets = spyLinks.map(function (a) { return doc.getElementById(a.dataset.nav); });
    if (spyTargets.some(function (t) { return !t; })) { spyLinks = []; spyTargets = []; }
  }
  function spy() {
    if (!spyLinks.length) return;
    var line = window.innerHeight * .38, on = 0;
    spyTargets.forEach(function (t, i) { if (t.getBoundingClientRect().top <= line) on = i; });
    if (window.innerHeight + window.scrollY >= doc.documentElement.scrollHeight - 4) on = spyTargets.length - 1;
    if (on === spyOn) return;
    spyOn = on;
    spyLinks.forEach(function (a, i) {
      a.classList.toggle('is-on', i === on);
      if (i === on) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current');
    });
  }

  /* ───────────────────────── the menu's filter ───────────────────────── */

  function initFilter() {
    var chips = $$('.chip[data-filter]'), groups = $$('.group[data-group]');
    chips.forEach(function (c) {
      c.addEventListener('click', function () {
        var f = c.dataset.filter;
        chips.forEach(function (x) { var on = x === c; x.classList.toggle('is-on', on); x.setAttribute('aria-pressed', on ? 'true' : 'false'); });
        groups.forEach(function (g) {
          var show = f === 'all' || g.dataset.group === f;
          g.classList.toggle('is-off', !show);
          if (show) $$('.tile, [data-reveal]', g).forEach(function (t) { t.classList.add('in'); });
        });
      });
    });
  }

  /* ───────────────────────── pickup and delivery ───────────────────────── */

  function initRail() {
    var rail = $('.rail'), tiers = $$('.tier[data-tier]');
    if (!rail) return;
    tiers.forEach(function (t) {
      t.addEventListener('click', function () {
        tiers.forEach(function (x) { var on = x === t; x.classList.toggle('is-on', on); x.setAttribute('aria-pressed', on ? 'true' : 'false'); });
        rail.setAttribute('data-tier', t.dataset.tier);
      });
    });
    // where the line is wider than the screen, start with our own station in the middle
    var box = $('.rail-scroll', rail), home = $('.st.is-home', rail);
    if (box && home && box.scrollWidth > box.clientWidth) {
      box.scrollLeft = home.offsetLeft - (box.clientWidth - home.offsetWidth) / 2;
    }
  }

  /* ───────────────────────── a flavour flying to the order ───────────────────────── */

  function initFly() {
    if (calm || !doc.body.animate) return;
    doc.addEventListener('click', function (e) {
      var btn = e.target.closest && e.target.closest('[data-add]');
      if (!btn) return;
      var host = btn.closest('[data-product]');
      var bag = $('.bag');
      // the bar may be scrolled away; the button at the foot of the screen is the target then
      if (!bag || bag.getBoundingClientRect().bottom < 0 || top.classList.contains('is-away')) bag = $('#lstOrderBar .ob-icon') || bag;
      var pic = host && (host.querySelector('.tile-shot img') || (host.classList.contains('sp') && $('.stage-shots .shot.is-on')) ||
                         ((host.classList.contains('pp-order') || host.classList.contains('buybar')) && $('.pshot .shot')));
      if (!pic || !bag) return;
      var a = pic.getBoundingClientRect(), b = bag.getBoundingClientRect();
      if (!a.width || !b.width) return;
      var size = Math.min(a.width, 150);
      var f = pic.cloneNode(false);
      f.removeAttribute('srcset'); f.removeAttribute('sizes'); f.src = pic.currentSrc || pic.src;
      f.className = 'flyer'; f.removeAttribute('style');
      f.style.cssText = 'left:' + (a.left + a.width / 2 - size / 2) + 'px;top:' + (a.top + a.height / 2 - size / 2) + 'px;width:' + size + 'px;height:' + size + 'px';
      doc.body.appendChild(f);
      var dx = b.left + b.width / 2 - (a.left + a.width / 2), dy = b.top + b.height / 2 - (a.top + a.height / 2);
      f.animate([
        { transform: 'translate(0,0) scale(1) rotate(0deg)', opacity: 1 },
        { transform: 'translate(' + dx * .5 + 'px,' + (dy * .5 - 70) + 'px) scale(.75) rotate(160deg)', opacity: 1, offset: .5 },
        { transform: 'translate(' + dx + 'px,' + dy + 'px) scale(.16) rotate(340deg)', opacity: .5 }
      ], { duration: 720, easing: 'cubic-bezier(.3,.1,.3,1)' }).onfinish = function () { f.remove(); };
    });
  }

  /* ───────────────────────── the product page's follow-along bar ───────────────────────── */

  function initBuybar() {
    var bar = $('.buybar'), main = $('.pp-order');
    if (!bar || !main || !('IntersectionObserver' in window)) return;
    new IntersectionObserver(function (en) { bar.classList.toggle('show', !en[0].isIntersecting); }, { threshold: 0 }).observe(main);
  }

  /* ───────────────────────── go ───────────────────────── */

  function init() {
    setTone();
    initSheet(); initBag(); initStage(); initScrub(); initReveal(); initSpy(); initFilter(); initRail(); initFly(); initBuybar();
    syncTop(); if (!calm) scrub(); spy();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
  }
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', init);
  else init();
})();
