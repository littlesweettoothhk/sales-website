/*
  Little Sweet Tooth — order builder.

  Static, no backend: the visitor builds an order on the page, it is kept in
  localStorage, and checkout hands off to WhatsApp with an itemised message.
  The UI is injected from JS so the 16 HTML pages carry almost no markup.

  The catalogue lives here rather than being read off the page. A product page
  only renders one flavour, so a DOM-derived catalogue made every *other* line
  in the order look unknown — and an earlier version pruned those lines, which
  silently emptied the order as soon as you opened a flavour page.
*/
(function () {
  'use strict';

  var WA_NUMBER = '85298174221';
  var STORE_KEY = 'lst-order-v1';
  var FREE_DELIVERY = 1000;   // 免費送貨
  var RAIL_PICKUP  = 150;     // 東鐵沿綫交收
  // Where the $150 reward sits on the progress track. The two rewards are
  // decades apart in money, so the bar cannot be linear in dollars: $150 would
  // land at 15% and the run from there to $1000 would swallow the whole track.
  // Pinning $150 to a fixed mark keeps the first goal feeling reachable while
  // the fill still only ever moves forward.
  var RAIL_MARK = 40;         // %

  var isZH = !/^en/i.test(document.documentElement.lang || '');
  // Product pages live one level down, so asset paths need a prefix.
  var DEPTH = /\/products\//.test(location.pathname) ? '../' : './';

  var PRODUCTS = [
    { id: 'seasalt',     zh: '海鹽黑朱古力',   en: 'Sea Salt Dark Chocolate',    price: 60, unit: 'jar', img: 'sea-salt-dark-chocolate-brookies.webp' },
    { id: 'pepper',      zh: '麻香花椒',       en: 'Green Sichuan Pepper',       price: 62, unit: 'jar', img: 'green-sichuan-pepper-brookies.webp' },
    { id: 'caramel',     zh: '焦糖黑朱古力',   en: 'Caramel Dark Chocolate',     price: 35, unit: 'pcs', img: 'caramel-brookies.webp' },
    { id: 'marshmallow', zh: '棉花糖黑朱古力', en: 'Marshmallow Dark Chocolate', price: 35, unit: 'pcs', img: 'marshmallow-brookies.webp' },
    { id: 'peanut',      zh: '花生黑朱古力',   en: 'Peanut Dark Chocolate',      price: 35, unit: 'pcs', img: 'peanut-butter-brookies.webp' },
    { id: 'hojicha',     zh: '焙茶',           en: 'Hojicha',                    price: 35, unit: 'pcs', img: 'hojicha-brookies-new.webp' },
    { id: 'matcha',      zh: '抹茶',           en: 'Matcha',                     price: 35, unit: 'pcs', img: 'matcha-brookies-new.webp' }
  ];

  var catalog = {};
  PRODUCTS.forEach(function (p) {
    catalog[p.id] = {
      id: p.id,
      name: isZH ? p.zh : p.en,
      price: p.price,
      unit: p.unit,
      img: DEPTH + 'src/' + p.img
    };
  });

  var T = isZH ? {
    add: '加入訂單',
    order: '我的訂單', open: '查看訂單', close: '關閉',
    empty: '訂單仲係空嘅', emptyHint: '喺餐牌撳「加入訂單」就可以開始 ♥',
    subtotal: '小計', items: '件', checkout: 'WhatsApp 落單', clear: '清空',
    clearConfirm: '再撳一次確認清空',
    railLeft: function (n) { return '再買 $' + n + ' 就可以東鐵沿綫交收 ✿'; },
    freeLeft: function (n) { return '再買 $' + n + ' 即可免費送貨 ✨'; },
    // past $150 the first reward is banked — say so, then point at the next one
    railGot: function (n) { return '東鐵沿綫交收已解鎖 ✿ ' + T.freeLeft(n); },
    freeGot: '已達免費送貨 ✨ 多謝你 ♥',
    progressLabel: '交收優惠進度',
    incFor: function (n) { return '增加 ' + n; },
    decFor: function (n) { return '減少 ' + n; },
    rmFor:  function (n) { return '移除 ' + n; },
    note: '落單後我哋會 WhatsApp 同你確認交收時間同地點 ♥',
    unitJar: '每樽', unitPcs: '每件',
    greet: '你好 Little Sweet Tooth ♥\n我想訂：',
    tail: '\n交收方式：\n希望交收日期：'
  } : {
    add: 'Add to order',
    order: 'My Order', open: 'View order', close: 'Close',
    empty: 'Your order is empty', emptyHint: 'Tap "Add to order" on the menu to start ♥',
    subtotal: 'Subtotal', items: 'items', checkout: 'Order on WhatsApp', clear: 'Clear',
    clearConfirm: 'Tap again to clear',
    railLeft: function (n) { return '$' + n + ' more for East Rail Line pickup ✿'; },
    freeLeft: function (n) { return '$' + n + ' more for free delivery ✨'; },
    railGot: function (n) { return 'East Rail Line pickup unlocked ✿ ' + T.freeLeft(n); },
    freeGot: 'Free delivery unlocked ✨ thank you ♥',
    progressLabel: 'Delivery reward progress',
    incFor: function (n) { return 'Add one ' + n; },
    decFor: function (n) { return 'Remove one ' + n; },
    rmFor:  function (n) { return 'Remove ' + n; },
    note: "We'll confirm pickup time and place with you on WhatsApp ♥",
    unitJar: 'per jar', unitPcs: 'per piece',
    greet: 'Hi Little Sweet Tooth ♥\nI would like to order:',
    tail: '\nPickup / delivery:\nPreferred date:'
  };

  var SVG = {
    bag: '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 8h12l-1 12H7L6 8Z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/></svg>',
    plus: '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
    minus: '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14"/></svg>',
    x: '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>',
    trash: '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 7h14M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>'
  };

  /* ---------- state ---------- */

  var cart = load();

  function load() {
    try {
      var raw = JSON.parse(localStorage.getItem(STORE_KEY) || '{}');
      var out = {};
      Object.keys(raw).forEach(function (k) {
        // Only ids we still sell survive, but the check is against the built-in
        // catalogue — never against whatever happens to be on this page.
        if (!catalog[k]) return;
        var n = parseInt(raw[k], 10);
        if (n > 0) out[k] = Math.min(n, 99);
      });
      return out;
    } catch (e) { return {}; }
  }
  function save() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(cart)); } catch (e) {}
  }

  function count() {
    return Object.keys(cart).reduce(function (s, k) { return s + cart[k]; }, 0);
  }
  function total() {
    return Object.keys(cart).reduce(function (s, k) {
      return s + catalog[k].price * cart[k];
    }, 0);
  }
  function setQty(id, n) {
    if (!catalog[id]) return;
    n = Math.max(0, Math.min(99, n));
    if (n === 0) delete cart[id]; else cart[id] = n;
    save();
    render();
  }

  function unitLabel(u) { return u === 'jar' ? T.unitJar : T.unitPcs; }

  /* ---------- steppers on the cards ---------- */

  function buildSteppers() {
    document.querySelectorAll('[data-product]').forEach(function (card) {
      var id = card.getAttribute('data-id');
      if (!catalog[id] || card.querySelector('.pc-add')) return;
      // "+1" and "−1" read identically on every card, so a screen reader user
      // tabbing the menu hears the same two words seven times over. Name them.
      var nm = catalog[id].name;
      var wrap = document.createElement('div');
      wrap.className = 'pc-add';
      wrap.innerHTML =
        '<button type="button" class="pc-add-btn" data-add="' + id + '">' +
          SVG.plus + '<span>' + T.add + '</span>' +
        '</button>' +
        '<div class="qty" data-qty-for="' + id + '" hidden>' +
          '<button type="button" class="qty-btn" data-dec="' + id + '" aria-label="' + T.decFor(nm) + '">' + SVG.minus + '</button>' +
          '<span class="qty-n" aria-live="polite">0</span>' +
          '<button type="button" class="qty-btn" data-inc="' + id + '" aria-label="' + T.incFor(nm) + '">' + SVG.plus + '</button>' +
        '</div>';
      card.appendChild(wrap);
    });
  }

  /* ---------- order bar + drawer ---------- */

  function buildChrome() {
    if (document.getElementById('lstOrderBar')) return;

    var bar = document.createElement('div');
    bar.className = 'order-bar';
    bar.id = 'lstOrderBar';
    bar.innerHTML =
      '<button type="button" class="ob-btn" data-cart-open>' +
        '<span class="ob-icon">' + SVG.bag + '<span class="ob-count">0</span></span>' +
        '<span class="ob-label">' + T.open + '</span>' +
        '<span class="ob-total">$0</span>' +
      '</button>';

    var backdrop = document.createElement('div');
    backdrop.className = 'cart-backdrop';
    backdrop.setAttribute('data-cart-close', '');

    var drawer = document.createElement('aside');
    drawer.className = 'cart-drawer';
    drawer.id = 'lstCart';
    drawer.setAttribute('role', 'dialog');
    drawer.setAttribute('aria-modal', 'true');
    drawer.setAttribute('aria-label', T.order);
    // Closed, the drawer is only parked off-screen by a transform, so without
    // this it stays in the tab order and a keyboard user walks into a cart
    // they cannot see. CSS drops `visibility` to match once it has slid shut.
    drawer.setAttribute('inert', '');
    drawer.innerHTML =
      '<div class="cart-head">' +
        '<h2>' + T.order + '</h2>' +
        '<button type="button" class="cart-close" data-cart-close aria-label="' + T.close + '">' + SVG.x + '</button>' +
      '</div>' +
      '<div class="cart-body">' +
        '<ul class="cart-items"></ul>' +
        '<div class="cart-empty">' +
          '<div class="ce-emoji">🍪</div>' +
          '<p class="ce-title">' + T.empty + '</p>' +
          '<p class="ce-hint">' + T.emptyHint + '</p>' +
        '</div>' +
      '</div>' +
      '<div class="cart-foot">' +
        '<div class="cart-progress">' +
          '<div class="cp-track" role="progressbar" aria-valuemin="0" aria-valuemax="100" ' +
               'aria-valuenow="0" aria-label="' + T.progressLabel + '"><div class="cp-fill"></div></div>' +
          '<p class="cp-msg"></p>' +
        '</div>' +
        '<div class="cart-total" aria-live="polite" aria-atomic="true">' +
          '<span>' + T.subtotal + '</span><strong class="ct-val">$0</strong></div>' +
        '<a class="cart-checkout" href="#" target="_blank" rel="noopener">' + SVG.bag + T.checkout + '</a>' +
        '<button type="button" class="cart-clear" data-cart-clear aria-live="polite">' + T.clear + '</button>' +
        '<p class="cart-note">' + T.note + '</p>' +
      '</div>';

    document.body.appendChild(bar);
    document.body.appendChild(backdrop);
    document.body.appendChild(drawer);
  }

  /* ---------- open / close ---------- */

  var lastFocus = null;

  function openCart() {
    lastFocus = document.activeElement;
    document.body.classList.add('cart-open');
    var d = document.getElementById('lstCart');
    d.removeAttribute('inert');
    d.classList.add('open');
    var f = d.querySelector('.cart-close');
    if (f) f.focus();
    document.addEventListener('keydown', onKey);
  }
  function closeCart() {
    var d = document.getElementById('lstCart');
    document.body.classList.remove('cart-open');
    d.classList.remove('open');
    document.removeEventListener('keydown', onKey);
    disarmClear();
    // Return focus first: `inert` on an ancestor of the focused element would
    // otherwise blur it to <body> and lose the caller's place on the page.
    if (lastFocus && lastFocus.focus) lastFocus.focus();
    d.setAttribute('inert', '');
  }

  /* ---------- clearing, in two deliberate taps ---------- */

  /* One stray tap next to the checkout button used to wipe an order outright,
     with nothing to undo it. The button now has to be armed first, and it
     disarms itself if it is left alone. */
  var clearArmed = false, clearTimer = null;

  function disarmClear() {
    clearArmed = false;
    if (clearTimer) { clearTimeout(clearTimer); clearTimer = null; }
    var b = document.querySelector('.cart-clear');
    if (b) { b.classList.remove('armed'); b.textContent = T.clear; }
  }
  function onClear(btn) {
    if (!clearArmed) {
      clearArmed = true;
      btn.classList.add('armed');
      btn.textContent = T.clearConfirm;
      clearTimer = setTimeout(disarmClear, 5000);
      return;
    }
    disarmClear();
    cart = {};
    save();
    render();
  }
  function onKey(e) {
    if (e.key === 'Escape') { closeCart(); return; }
    if (e.key !== 'Tab') return;
    var d = document.getElementById('lstCart');
    var f = d.querySelectorAll('a[href], button:not([disabled])');
    if (!f.length) return;
    var first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }

  /* ---------- WhatsApp message ---------- */

  function waLink() {
    var lines = [T.greet, ''];
    Object.keys(cart).forEach(function (id) {
      var p = catalog[id];
      lines.push('• ' + p.name + ' (' + unitLabel(p.unit) + ') × ' + cart[id] +
                 ' — $' + (p.price * cart[id]));
    });
    lines.push('', T.subtotal + '：$' + total(), T.tail);
    return 'https://wa.me/' + WA_NUMBER + '?text=' + encodeURIComponent(lines.join('\n'));
  }

  /* ---------- the drawer's item rows ---------- */

  /* Rows are built once and then updated in place. Rebuilding the list with
     innerHTML destroyed the very button that had just been pressed, so every
     step of a quantity threw keyboard focus back to <body> — which also broke
     out of the dialog's focus trap — and re-decoded four photos on each tap. */

  function buildRow(id) {
    var p = catalog[id];
    var li = document.createElement('li');
    li.className = 'cart-item';
    li.setAttribute('data-row', id);
    li.innerHTML =
      '<img src="' + p.img + '" alt="" width="64" height="64" loading="lazy" decoding="async">' +
      '<div class="ci-info">' +
        '<span class="ci-name">' + p.name + '</span>' +
        '<span class="ci-unit">' + unitLabel(p.unit) + ' · $' + p.price + '</span>' +
      '</div>' +
      '<div class="qty ci-qty">' +
        '<button type="button" class="qty-btn" data-dec="' + id + '"></button>' +
        '<span class="qty-n" aria-live="polite"></span>' +
        '<button type="button" class="qty-btn" data-inc="' + id + '" aria-label="' + T.incFor(p.name) + '">' + SVG.plus + '</button>' +
      '</div>' +
      '<span class="ci-sum"></span>';
    return li;
  }

  function updateRow(li, id) {
    var p = catalog[id], q = cart[id];
    var dec = li.querySelector('[data-dec]');
    var last = q === 1;
    // touch innerHTML only when the icon actually has to change
    if (dec.getAttribute('data-icon') !== (last ? 'trash' : 'minus')) {
      dec.setAttribute('data-icon', last ? 'trash' : 'minus');
      dec.innerHTML = last ? SVG.trash : SVG.minus;
    }
    dec.setAttribute('aria-label', last ? T.rmFor(p.name) : T.decFor(p.name));
    var n = li.querySelector('.qty-n');
    if (n.textContent !== String(q)) n.textContent = q;
    var sum = li.querySelector('.ci-sum'), val = '$' + p.price * q;
    if (sum.textContent !== val) sum.textContent = val;
  }

  // A row carrying focus is about to go; hand focus to a neighbour rather than
  // letting it fall to <body> and out of the drawer.
  function rehomeFocus(li) {
    var sib = li.nextElementSibling || li.previousElementSibling;
    var next = (sib && sib.querySelector('[data-dec]')) ||
               document.querySelector('#lstCart .cart-close');
    if (next) next.focus();
  }

  function renderItems(list) {
    Array.prototype.slice.call(list.children).forEach(function (li) {
      var id = li.getAttribute('data-row');
      if (cart[id]) return;
      if (li.contains(document.activeElement)) rehomeFocus(li);
      list.removeChild(li);
    });
    // cart key order is append-only, so appending keeps the two in step
    Object.keys(cart).forEach(function (id) {
      var li = list.querySelector('[data-row="' + id + '"]');
      if (!li) { li = buildRow(id); list.appendChild(li); }
      updateRow(li, id);
    });
  }

  /* ---------- delivery progress ---------- */

  function progress(sum) {
    if (sum >= FREE_DELIVERY) return { pct: 100, text: T.freeGot, done: true };
    if (sum >= RAIL_PICKUP) {
      return {
        pct: RAIL_MARK + (sum - RAIL_PICKUP) / (FREE_DELIVERY - RAIL_PICKUP) * (100 - RAIL_MARK),
        text: T.railGot(FREE_DELIVERY - sum), done: false
      };
    }
    return { pct: sum / RAIL_PICKUP * RAIL_MARK, text: T.railLeft(RAIL_PICKUP - sum), done: false };
  }

  /* ---------- render ---------- */

  function render() {
    var n = count(), sum = total();

    Object.keys(catalog).forEach(function (id) {
      var q = cart[id] || 0;
      document.querySelectorAll('[data-qty-for="' + id + '"]').forEach(function (box) {
        box.hidden = q === 0;
        var nEl = box.querySelector('.qty-n');
        if (nEl) nEl.textContent = q;
      });
      document.querySelectorAll('[data-add="' + id + '"]').forEach(function (btn) {
        btn.hidden = q > 0;
      });
      document.querySelectorAll('[data-product][data-id="' + id + '"]').forEach(function (c) {
        c.classList.toggle('in-order', q > 0);
      });
    });

    var bar = document.getElementById('lstOrderBar');
    if (bar) {
      bar.classList.toggle('show', n > 0);
      bar.querySelector('.ob-count').textContent = n;
      bar.querySelector('.ob-total').textContent = '$' + sum;
      bar.querySelector('.ob-label').textContent = T.open + ' · ' + n + ' ' + T.items;
    }

    var drawer = document.getElementById('lstCart');
    if (!drawer) return;

    renderItems(drawer.querySelector('.cart-items'));

    drawer.querySelector('.cart-empty').hidden = n > 0;
    drawer.querySelector('.cart-foot').hidden = n === 0;
    drawer.querySelector('.ct-val').textContent = '$' + sum;
    drawer.querySelector('.cart-checkout').href = waLink();
    if (n === 0) disarmClear();

    var p = progress(sum);
    var pct = Math.round(p.pct);
    var fill = drawer.querySelector('.cp-fill');
    fill.style.width = Math.max(4, pct) + '%';
    fill.classList.toggle('done', p.done);
    drawer.querySelector('.cp-msg').textContent = p.text;
    var track = drawer.querySelector('.cp-track');
    track.setAttribute('aria-valuenow', pct);
    track.setAttribute('aria-valuetext', p.text);
  }

  /* ---------- events ---------- */

  function onClick(e) {
    var t = e.target.closest('[data-add],[data-inc],[data-dec],[data-cart-open],[data-cart-close],[data-cart-clear]');
    if (!t) return;

    if (t.hasAttribute('data-cart-open'))  { e.preventDefault(); openCart(); return; }
    if (t.hasAttribute('data-cart-close')) { e.preventDefault(); closeCart(); return; }
    if (t.hasAttribute('data-cart-clear')) { e.preventDefault(); onClear(t); return; }

    e.preventDefault();
    // any other order activity means the visitor is not clearing after all
    disarmClear();
    var id = t.getAttribute('data-add') || t.getAttribute('data-inc') || t.getAttribute('data-dec');
    if (!catalog[id]) return;
    var cur = cart[id] || 0;
    setQty(id, t.hasAttribute('data-dec') ? cur - 1 : cur + 1);

    if (t.hasAttribute('data-add')) {
      var card = t.closest('[data-product]');
      if (card) {
        card.classList.add('just-added');
        setTimeout(function () { card.classList.remove('just-added'); }, 700);
      }
    }
  }

  // Another tab (or the other language) may change the order; stay in sync.
  function onStorage(e) {
    if (e.key !== STORE_KEY) return;
    cart = load();
    render();
  }

  /* Controls that appear after load — the preview sheet, the product-page
     sticky button — are built elsewhere but must be driven from here, so the
     order stays the single source of truth. Read-only apart from refresh(). */
  function expose() {
    window.LSTOrder = {
      refresh: render,
      qty: function (id) { return cart[id] || 0; },
      product: function (id) { return catalog[id] || null; },
      addLabel: T.add,
      // so steppers built elsewhere name their product too, instead of
      // offering a row of identical "+1" buttons
      stepLabels: function (id) {
        var nm = catalog[id] ? catalog[id].name : '';
        return { inc: T.incFor(nm), dec: T.decFor(nm) };
      }
    };
  }

  function init() {
    buildSteppers();
    buildChrome();
    expose();
    document.addEventListener('click', onClick);
    window.addEventListener('storage', onStorage);
    // bfcache restores can hand back a stale DOM with a newer stored order
    window.addEventListener('pageshow', function (e) {
      if (e.persisted) { cart = load(); render(); }
    });
    render();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
