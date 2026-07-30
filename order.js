/*
  Little Sweet Tooth — order builder.

  Static, no backend: the visitor builds an order on the page, it is kept in
  localStorage, and checkout hands off to WhatsApp with an itemised message.
  All UI below is injected from JS so the 16 HTML pages only have to carry
  data attributes on their product cards.
*/
(function () {
  'use strict';

  var WA_NUMBER = '85298174221';
  var STORE_KEY = 'lst-order-v1';
  var FREE_DELIVERY = 1000;   // 免費送貨
  var RAIL_PICKUP  = 150;     // 東鐵沿綫交收

  var isZH = !/^en/i.test(document.documentElement.lang || '');

  var T = isZH ? {
    add: '加入訂單', added: '已加入', qty: '數量',
    order: '我的訂單', open: '查看訂單', close: '關閉',
    empty: '訂單仲係空嘅', emptyHint: '喺餐牌撳「加入訂單」就可以開始 ♥',
    subtotal: '小計', items: '件', checkout: 'WhatsApp 落單',
    remove: '移除', clear: '清空',
    railLeft: function (n) { return '再買 $' + n + ' 就可以東鐵沿綫交收 ✿'; },
    freeLeft: function (n) { return '再買 $' + n + ' 即可免費送貨 ✨'; },
    railGot: '已達東鐵沿綫交收 ✿',
    freeGot: '已達免費送貨 ✨',
    note: '落單後我哋會 WhatsApp 同你確認交收時間同地點 ♥',
    unitJar: '每樽', unitPcs: '每件',
    greet: '你好 Little Sweet Tooth ♥\n我想訂：',
    tail: '\n交收方式：\n希望交收日期：'
  } : {
    add: 'Add to order', added: 'Added', qty: 'Quantity',
    order: 'My Order', open: 'View order', close: 'Close',
    empty: 'Your order is empty', emptyHint: 'Tap "Add to order" on the menu to start ♥',
    subtotal: 'Subtotal', items: 'items', checkout: 'Order on WhatsApp',
    remove: 'Remove', clear: 'Clear',
    railLeft: function (n) { return '$' + n + ' more for East Rail Line pickup ✿'; },
    freeLeft: function (n) { return '$' + n + ' more for free delivery ✨'; },
    railGot: 'East Rail Line pickup unlocked ✿',
    freeGot: 'Free delivery unlocked ✨',
    note: "We'll confirm pickup time and place with you on WhatsApp ♥",
    unitJar: 'per jar', unitPcs: 'per piece',
    greet: 'Hi Little Sweet Tooth ♥\nI would like to order:',
    tail: '\nPickup / delivery:\nPreferred date:'
  };

  var SVG = {
    bag: '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 8h12l-1 12H7L6 8Z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/></svg>',
    plus: '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
    minus: '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14"/></svg>',
    x: '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>'
  };

  /* ---------- state ---------- */

  var cart = load();
  var catalog = {};          // id -> {id,name,price,unit,img,url}

  function load() {
    try {
      var raw = JSON.parse(localStorage.getItem(STORE_KEY) || '{}');
      var out = {};
      Object.keys(raw).forEach(function (k) {
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
      var p = catalog[k];
      return s + (p ? p.price * cart[k] : 0);
    }, 0);
  }
  function setQty(id, n) {
    n = Math.max(0, Math.min(99, n));
    if (n === 0) delete cart[id]; else cart[id] = n;
    save();
    render();
  }

  /* ---------- catalog from the DOM ---------- */

  function readCatalog() {
    document.querySelectorAll('[data-product]').forEach(function (el) {
      var id = el.getAttribute('data-id');
      if (!id) return;
      catalog[id] = {
        id: id,
        name: el.getAttribute('data-name') || id,
        price: parseFloat(el.getAttribute('data-price')) || 0,
        unit: el.getAttribute('data-unit') || 'pcs',
        img: el.getAttribute('data-img') || '',
        url: el.getAttribute('data-url') || ''
      };
    });
    // Drop anything saved from an older menu so totals stay honest.
    Object.keys(cart).forEach(function (k) { if (!catalog[k]) delete cart[k]; });
  }

  function unitLabel(u) { return u === 'jar' ? T.unitJar : T.unitPcs; }

  /* ---------- steppers on the cards ---------- */

  function buildSteppers() {
    document.querySelectorAll('[data-product]').forEach(function (card) {
      if (card.querySelector('.pc-add')) return;
      var id = card.getAttribute('data-id');
      var wrap = document.createElement('div');
      wrap.className = 'pc-add';
      wrap.innerHTML =
        '<button type="button" class="pc-add-btn" data-add="' + id + '">' +
          SVG.plus + '<span>' + T.add + '</span>' +
        '</button>' +
        '<div class="qty" data-qty-for="' + id + '" hidden>' +
          '<button type="button" class="qty-btn" data-dec="' + id + '" aria-label="−1">' + SVG.minus + '</button>' +
          '<span class="qty-n" aria-live="polite">0</span>' +
          '<button type="button" class="qty-btn" data-inc="' + id + '" aria-label="+1">' + SVG.plus + '</button>' +
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
          '<div class="cp-track"><div class="cp-fill"></div></div>' +
          '<p class="cp-msg"></p>' +
        '</div>' +
        '<div class="cart-total"><span>' + T.subtotal + '</span><strong class="ct-val">$0</strong></div>' +
        '<a class="cart-checkout" href="#" target="_blank" rel="noopener">' + T.checkout + '</a>' +
        '<button type="button" class="cart-clear" data-cart-clear>' + T.clear + '</button>' +
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
    d.classList.add('open');
    var f = d.querySelector('.cart-close');
    if (f) f.focus();
    document.addEventListener('keydown', onKey);
  }
  function closeCart() {
    document.body.classList.remove('cart-open');
    document.getElementById('lstCart').classList.remove('open');
    document.removeEventListener('keydown', onKey);
    if (lastFocus && lastFocus.focus) lastFocus.focus();
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
      if (!p) return;
      lines.push('• ' + p.name + ' (' + unitLabel(p.unit) + ') × ' + cart[id] +
                 ' — $' + (p.price * cart[id]));
    });
    lines.push('', T.subtotal + '：$' + total(), T.tail);
    return 'https://wa.me/' + WA_NUMBER + '?text=' + encodeURIComponent(lines.join('\n'));
  }

  /* ---------- render ---------- */

  function render() {
    var n = count(), sum = total();

    // steppers
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

    var list = drawer.querySelector('.cart-items');
    list.innerHTML = '';
    Object.keys(cart).forEach(function (id) {
      var p = catalog[id];
      if (!p) return;
      var li = document.createElement('li');
      li.className = 'cart-item';
      li.innerHTML =
        (p.img ? '<img src="' + p.img + '" alt="" width="64" height="64" loading="lazy" decoding="async">' : '') +
        '<div class="ci-info">' +
          '<span class="ci-name">' + p.name + '</span>' +
          '<span class="ci-unit">' + unitLabel(p.unit) + ' · $' + p.price + '</span>' +
        '</div>' +
        '<div class="qty ci-qty">' +
          '<button type="button" class="qty-btn" data-dec="' + id + '" aria-label="−1">' + SVG.minus + '</button>' +
          '<span class="qty-n">' + cart[id] + '</span>' +
          '<button type="button" class="qty-btn" data-inc="' + id + '" aria-label="+1">' + SVG.plus + '</button>' +
        '</div>' +
        '<span class="ci-sum">$' + (p.price * cart[id]) + '</span>';
      list.appendChild(li);
    });

    drawer.querySelector('.cart-empty').hidden = n > 0;
    drawer.querySelector('.cart-foot').hidden = n === 0;
    drawer.querySelector('.ct-val').textContent = '$' + sum;
    drawer.querySelector('.cart-checkout').href = waLink();

    // delivery progress
    var fill = drawer.querySelector('.cp-fill');
    var msg = drawer.querySelector('.cp-msg');
    var pct, text;
    if (sum >= FREE_DELIVERY)      { pct = 100; text = T.freeGot; }
    else if (sum >= RAIL_PICKUP)   { pct = Math.round(sum / FREE_DELIVERY * 100); text = T.freeLeft(FREE_DELIVERY - sum); }
    else                           { pct = Math.round(sum / RAIL_PICKUP * 100 * 0.4); text = T.railLeft(RAIL_PICKUP - sum); }
    fill.style.width = Math.max(4, pct) + '%';
    fill.classList.toggle('done', sum >= FREE_DELIVERY);
    msg.textContent = text;
  }

  /* ---------- events ---------- */

  function onClick(e) {
    var t = e.target.closest('[data-add],[data-inc],[data-dec],[data-cart-open],[data-cart-close],[data-cart-clear]');
    if (!t) return;

    if (t.hasAttribute('data-cart-open'))  { e.preventDefault(); openCart(); return; }
    if (t.hasAttribute('data-cart-close')) { e.preventDefault(); closeCart(); return; }
    if (t.hasAttribute('data-cart-clear')) { e.preventDefault(); cart = {}; save(); render(); return; }

    e.preventDefault();
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

  function init() {
    readCatalog();
    if (!Object.keys(catalog).length) return;
    buildSteppers();
    buildChrome();
    document.addEventListener('click', onClick);
    render();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
