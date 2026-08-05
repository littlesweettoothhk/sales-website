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
    /* ---- the交收詳情 step ---- */
    details: '交收詳情',
    next: '下一步 ✿ 填交收詳情',
    back: '← 返回訂單',
    dvLead: '揀好交收方式、地點同時間，落單訊息就會自動幫你填好 ♥',
    mMethod: '交收方式',
    mFotan: '火炭港鐵站交收',      mFotanS: '任何消費都可以',
    mStation: '東鐵沿綫車站交收',  mStationS: '滿 $150',
    mHome: '免費送貨上門',         mHomeS: '滿 $1000',
    mSf: '順豐到付',               mSfS: '運費到付',
    fStation: '車站',   fStationPick: '請揀車站',
    fSearch: '搵地址',  fSearchPh: '輸入街名或大廈名…',
    fDistrict: '地區',  fDistrictPick: '請揀地區',
    fAddr: '地址',      fAddrPh: '街道、屋苑或大廈',
    fUnit: '樓層／室（可選）',
    fDate: '希望交收日期', fTime: '希望交收時間',
    leadHint: function (d) { return '最早 ' + d + '：請提早 7 日落單，等我哋新鮮烘焙 ♥ 急單歡迎 DM ✿'; },
    errMethod: '請先揀交收方式',
    errStation: '請揀你想喺邊個站交收',
    errAddress: '請填地區同地址',
    errDate: function (d) { return '請揀交收日期，最早 ' + d; },
    errTime: '請揀交收時間',
    msgMethod: '交收方式', msgAddress: '送貨地址',
    msgDate: '希望交收日期', msgTime: '希望交收時間',
    week: ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六']
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
    /* ---- the pickup-details step ---- */
    details: 'Pickup details',
    next: 'Next ✿ pickup details',
    back: '← Back to order',
    dvLead: 'Choose how, where and when to receive it — your WhatsApp message is filled in for you ♥',
    mMethod: 'Pickup / delivery',
    mFotan: 'Fo Tan MTR pickup',            mFotanS: 'any spend',
    mStation: 'East Rail Line station',     mStationS: '$150+',
    mHome: 'Free home delivery',            mHomeS: '$1000+',
    mSf: 'SF Express',                      mSfS: 'freight collect',
    fStation: 'Station',   fStationPick: 'Choose a station',
    fSearch: 'Find address', fSearchPh: 'Type a street or building…',
    fDistrict: 'District', fDistrictPick: 'Choose a district',
    fAddr: 'Address',      fAddrPh: 'Street, estate or building',
    fUnit: 'Floor / flat (optional)',
    fDate: 'Preferred date', fTime: 'Preferred time',
    leadHint: function (d) { return 'Earliest ' + d + ' — please order 7 days ahead so we can bake fresh ♥ Rush orders, just DM ✿'; },
    errMethod: 'Please choose how to receive it',
    errStation: 'Please choose a station',
    errAddress: 'Please fill in the district and address',
    errDate: function (d) { return 'Please choose a date, earliest ' + d; },
    errTime: 'Please choose a time',
    msgMethod: 'Pickup / delivery', msgAddress: 'Delivery address',
    msgDate: 'Preferred date', msgTime: 'Preferred time',
    week: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
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
        detailsHTML() +
      '</div>' +
      '<div class="cart-foot">' +
        '<div class="cart-progress">' +
          '<div class="cp-track" role="progressbar" aria-valuemin="0" aria-valuemax="100" ' +
               'aria-valuenow="0" aria-label="' + T.progressLabel + '"><div class="cp-fill"></div></div>' +
          '<p class="cp-msg"></p>' +
        '</div>' +
        '<div class="cart-total" aria-live="polite" aria-atomic="true">' +
          '<span>' + T.subtotal + '</span><strong class="ct-val">$0</strong></div>' +
        '<button type="button" class="cart-next" data-step-details>' + T.next + '</button>' +
        '<a class="cart-checkout" href="#" target="_blank" rel="noopener">' + SVG.bag + T.checkout + '</a>' +
        '<button type="button" class="cart-back" data-step-items>' + T.back + '</button>' +
        '<button type="button" class="cart-clear" data-cart-clear aria-live="polite">' + T.clear + '</button>' +
        '<p class="cart-note">' + T.note + '</p>' +
      '</div>';
    drawer.setAttribute('data-step', 'items');

    document.body.appendChild(bar);
    document.body.appendChild(backdrop);
    document.body.appendChild(drawer);
    bindDetails(drawer);
  }

  /* ---------- the details form ---------- */

  function opt(value, label, sel) {
    return '<option value="' + value + '"' + (sel ? ' selected' : '') + '>' + label + '</option>';
  }

  function detailsHTML() {
    var methods = ['fotan', 'station', 'home', 'sf'].map(function (m) {
      var sub = m === 'fotan' ? T.mFotanS : m === 'station' ? T.mStationS :
                m === 'home' ? T.mHomeS : T.mSfS;
      return '<label class="dv-opt" data-method="' + m + '">' +
               '<input type="radio" name="lstMethod" value="' + m + '">' +
               '<span class="dv-opt-b"><span class="dv-opt-t">' + methodName(m) + '</span>' +
               '<span class="dv-opt-s">' + sub + '</span></span></label>';
    }).join('');

    var stations = opt('', T.fStationPick, true) +
      STATIONS.map(function (s) { return opt(loc(s), loc(s), false); }).join('');
    var districts = opt('', T.fDistrictPick, true) +
      DISTRICTS.map(function (d) { return opt(loc(d), loc(d), false); }).join('');

    return '<div class="dv">' +
      '<p class="dv-lead">' + T.dvLead + '</p>' +

      '<fieldset class="dv-block">' +
        '<legend>' + T.mMethod + '</legend>' +
        '<div class="dv-methods">' + methods + '</div>' +
      '</fieldset>' +

      '<div class="dv-block" data-for="station" hidden>' +
        '<label class="dv-lbl" for="lstStation">' + T.fStation + '</label>' +
        '<select class="dv-in" id="lstStation">' + stations + '</select>' +
      '</div>' +

      '<div class="dv-block" data-for="address" hidden>' +
        '<label class="dv-lbl" for="lstFind">' + T.fSearch + '</label>' +
        '<div class="dv-find">' +
          '<input class="dv-in" id="lstFind" type="text" autocomplete="off" spellcheck="false" ' +
                 'placeholder="' + T.fSearchPh + '" role="combobox" aria-expanded="false" ' +
                 'aria-autocomplete="list" aria-controls="lstFindList">' +
          '<ul class="dv-sug" id="lstFindList" role="listbox" hidden></ul>' +
        '</div>' +
        '<label class="dv-lbl" for="lstDistrict">' + T.fDistrict + '</label>' +
        '<select class="dv-in" id="lstDistrict">' + districts + '</select>' +
        '<label class="dv-lbl" for="lstAddr">' + T.fAddr + '</label>' +
        '<input class="dv-in" id="lstAddr" type="text" placeholder="' + T.fAddrPh + '">' +
        '<label class="dv-lbl" for="lstUnit">' + T.fUnit + '</label>' +
        '<input class="dv-in" id="lstUnit" type="text">' +
      '</div>' +

      '<div class="dv-block">' +
        '<label class="dv-lbl" for="lstDate">' + T.fDate + '</label>' +
        '<input class="dv-in" id="lstDate" type="date">' +
        '<p class="dv-hint" id="lstLead"></p>' +
        '<label class="dv-lbl" for="lstTime">' + T.fTime + '</label>' +
        '<input class="dv-in" id="lstTime" type="time">' +
      '</div>' +

      '<p class="dv-err" role="alert" hidden></p>' +
    '</div>';
  }

  function bindDetails(drawer) {
    var find = drawer.querySelector('#lstFind');
    var list = drawer.querySelector('#lstFindList');

    drawer.addEventListener('change', function (e) {
      var t = e.target;
      if (t.name === 'lstMethod') { details.method = t.value; details.station = ''; }
      else if (t.id === 'lstStation')  details.station  = t.value;
      else if (t.id === 'lstDistrict') details.district = t.value;
      else if (t.id === 'lstDate')     details.date     = t.value;
      else if (t.id === 'lstTime')     details.time     = t.value;
      else return;
      saveDetails();
      renderDetails();
    });

    drawer.addEventListener('input', function (e) {
      var t = e.target;
      if (t.id === 'lstAddr')      { details.addr = t.value; saveDetails(); renderDetails(); }
      else if (t.id === 'lstUnit') { details.unit = t.value; saveDetails(); }
      else if (t.id === 'lstFind') { queueSearch(t.value); }
    });

    var timer = null;
    function queueSearch(q) {
      if (timer) clearTimeout(timer);
      timer = setTimeout(function () {
        alsSearch(q.trim(), function (rows) { showSuggestions(rows); });
      }, 300);
    }

    function showSuggestions(rows) {
      list.innerHTML = rows.map(function (r, i) {
        return '<li role="option" id="lstSug' + i + '" tabindex="-1" ' +
               'data-line="' + escAttr(r.line) + '" data-district="' + escAttr(r.district) + '">' +
               escHTML(r.line) + (r.district ? '<span class="dv-sug-d">' + escHTML(r.district) + '</span>' : '') +
               '</li>';
      }).join('');
      var has = rows.length > 0;
      list.hidden = !has;
      find.setAttribute('aria-expanded', has ? 'true' : 'false');
    }

    list.addEventListener('click', function (e) {
      var li = e.target.closest('li[data-line]');
      if (!li) return;
      details.addr = li.getAttribute('data-line');
      if (li.getAttribute('data-district')) details.district = li.getAttribute('data-district');
      saveDetails();
      list.hidden = true;
      find.value = '';
      find.setAttribute('aria-expanded', 'false');
      renderDetails();
      var a = drawer.querySelector('#lstAddr');
      if (a) a.focus();
    });
  }

  function escHTML(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  function escAttr(s) { return escHTML(s).replace(/"/g, '&quot;'); }

  /* Push the stored details back into the form and show only the fields the
     chosen method actually needs. Values are written only when they differ, so
     nothing steals the caret from someone mid-type. */
  function renderDetails() {
    var drawer = document.getElementById('lstCart');
    if (!drawer) return;
    var dv = drawer.querySelector('.dv');
    if (!dv) return;
    var sum = total();
    var allowed = methodsFor(sum);

    dv.querySelectorAll('.dv-opt').forEach(function (o) {
      var m = o.getAttribute('data-method');
      var on = allowed.indexOf(m) >= 0;
      o.hidden = !on;
      var r = o.querySelector('input');
      r.disabled = !on;
      r.checked = on && details.method === m;
      o.classList.toggle('sel', r.checked);
    });

    var isStation = details.method === 'station';
    var isAddr = needsAddress(details.method);
    dv.querySelector('[data-for="station"]').hidden = !isStation;
    dv.querySelector('[data-for="address"]').hidden = !isAddr;

    setVal(dv.querySelector('#lstStation'), details.station);
    setVal(dv.querySelector('#lstDistrict'), details.district);
    setVal(dv.querySelector('#lstAddr'), details.addr);
    setVal(dv.querySelector('#lstUnit'), details.unit);

    var earliest = earliestDate();
    var date = dv.querySelector('#lstDate');
    date.min = earliest;
    setVal(date, details.date);
    dv.querySelector('#lstLead').textContent = T.leadHint(earliest);
    setVal(dv.querySelector('#lstTime'), details.time);

    var problem = detailsProblem(sum);
    var err = dv.querySelector('.dv-err');
    // only nag once they have started; never on a form they have not touched
    var started = !!details.method;
    err.hidden = !problem || !started;
    err.textContent = problem ? problemText(problem) : '';

    var go = drawer.querySelector('.cart-checkout');
    go.classList.toggle('is-off', !!problem);
    go.setAttribute('aria-disabled', problem ? 'true' : 'false');
    if (!problem) go.href = waLink();
  }

  function setVal(el, v) { if (el && el.value !== v) el.value = v; }

  function goStep(step) {
    var drawer = document.getElementById('lstCart');
    var onDetails = step === 'details';
    drawer.setAttribute('data-step', step);
    drawer.querySelector('.cart-head h2').textContent = onDetails ? T.details : T.order;
    drawer.setAttribute('aria-label', onDetails ? T.details : T.order);
    disarmClear();
    if (step === 'details') {
      renderDetails();
      var first = drawer.querySelector('.dv-opt:not([hidden]) input');
      if (first) first.focus();
    } else {
      var back = drawer.querySelector('.cart-next');
      if (back) back.focus();
    }
    drawer.querySelector('.cart-body').scrollTop = 0;
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
    // the delivery details go with it — an address should not outlive the order
    clearDetails();
    render();
  }
  function onKey(e) {
    if (e.key === 'Escape') { closeCart(); return; }
    if (e.key !== 'Tab') return;
    var d = document.getElementById('lstCart');
    var f = [].slice.call(d.querySelectorAll(
      'a[href], button:not([disabled]), select:not([disabled]), input:not([disabled])'
    )).filter(function (el) { return el.offsetParent !== null; });
    if (!f.length) return;
    var first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }

  /* ════════════════════════════════════════════════════════════════
     Delivery details — how, where and when

     A second step inside the drawer, so the WhatsApp message arrives
     complete instead of carrying two blank lines to settle over chat.
     The tiers are the ones the FAQ already promises: Fo Tan at any spend,
     the whole East Rail Line from $150, delivery to an address from $1000 —
     with SF freight-collect available throughout. Nothing here invents a
     rule; it only asks for what we were going to ask for anyway.
     ════════════════════════════════════════════════════════════════ */

  var DETAIL_KEY = 'lst-delivery-v1';
  var LEAD_DAYS = 7;          // 請提早 7 日落單

  /* 東鐵綫, in line order. Lo Wu and Lok Ma Chau are boundary crossings that
     need travel documents, and Racecourse only opens on race days, so none of
     the three works as a meeting point. */
  var STATIONS = [
    ['金鐘', 'Admiralty'], ['會展', 'Exhibition Centre'], ['紅磡', 'Hung Hom'],
    ['旺角東', 'Mong Kok East'], ['九龍塘', 'Kowloon Tong'], ['大圍', 'Tai Wai'],
    ['沙田', 'Sha Tin'], ['火炭', 'Fo Tan'], ['大學', 'University'],
    ['大埔墟', 'Tai Po Market'], ['太和', 'Tai Wo'], ['粉嶺', 'Fanling'],
    ['上水', 'Sheung Shui']
  ];

  var DISTRICTS = [
    ['中西區', 'Central & Western'], ['灣仔區', 'Wan Chai'], ['東區', 'Eastern'],
    ['南區', 'Southern'], ['油尖旺區', 'Yau Tsim Mong'], ['深水埗區', 'Sham Shui Po'],
    ['九龍城區', 'Kowloon City'], ['黃大仙區', 'Wong Tai Sin'], ['觀塘區', 'Kwun Tong'],
    ['葵青區', 'Kwai Tsing'], ['荃灣區', 'Tsuen Wan'], ['屯門區', 'Tuen Mun'],
    ['元朗區', 'Yuen Long'], ['北區', 'North'], ['大埔區', 'Tai Po'],
    ['沙田區', 'Sha Tin'], ['西貢區', 'Sai Kung'], ['離島區', 'Islands']
  ];

  function loc(pair) { return isZH ? pair[0] : pair[1]; }

  /* Which options this subtotal has earned. Station pickup stays on the table
     above $1000 — free delivery is an extra, not a replacement. */
  function methodsFor(sum) {
    var out = [sum < RAIL_PICKUP ? 'fotan' : 'station'];
    if (sum >= FREE_DELIVERY) out.push('home');
    out.push('sf');
    return out;
  }
  function needsAddress(m) { return m === 'home' || m === 'sf'; }
  function methodName(m) {
    return m === 'fotan' ? T.mFotan : m === 'station' ? T.mStation :
           m === 'home' ? T.mHome : T.mSf;
  }

  var BLANK = { method: '', station: '', district: '', addr: '', unit: '', date: '', time: '' };
  var details = loadDetails();

  function loadDetails() {
    var out = {}, raw = {};
    try { raw = JSON.parse(localStorage.getItem(DETAIL_KEY) || '{}') || {}; } catch (e) { raw = {}; }
    Object.keys(BLANK).forEach(function (k) {
      out[k] = typeof raw[k] === 'string' ? raw[k] : '';
    });
    return out;
  }
  function saveDetails() {
    try { localStorage.setItem(DETAIL_KEY, JSON.stringify(details)); } catch (e) {}
  }
  function clearDetails() {
    details = {};
    Object.keys(BLANK).forEach(function (k) { details[k] = ''; });
    try { localStorage.removeItem(DETAIL_KEY); } catch (e) {}
  }

  /* ---------- dates ---------- */

  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  function isoDay(d) { return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); }
  function earliestDate() {
    var d = new Date(); d.setDate(d.getDate() + LEAD_DAYS);
    return isoDay(d);
  }
  function weekdayOf(iso) {
    var p = iso.split('-');
    var d = new Date(+p[0], +p[1] - 1, +p[2]);
    return isNaN(d.getTime()) ? '' : T.week[d.getDay()];
  }

  /* ---------- validation ---------- */

  /* Returns the field that still needs attention, or null when the details
     are complete for this subtotal. */
  function detailsProblem(sum) {
    var allowed = methodsFor(sum);
    if (!details.method || allowed.indexOf(details.method) < 0) return 'method';
    if (details.method === 'station' && !details.station) return 'station';
    if (needsAddress(details.method) && (!details.district || !details.addr.trim())) return 'address';
    if (!details.date || details.date < earliestDate()) return 'date';
    if (!details.time) return 'time';
    return null;
  }
  function problemText(which) {
    return which === 'method'  ? T.errMethod  :
           which === 'station' ? T.errStation :
           which === 'address' ? T.errAddress :
           which === 'date'    ? T.errDate(earliestDate()) : T.errTime;
  }

  function fullAddress() {
    return [details.district, details.addr.trim(), details.unit.trim()]
      .filter(function (x) { return x; }).join(' ');
  }

  /* ---------- the lines the message gains ---------- */

  function detailLines() {
    var out = [];
    var place = methodName(details.method);
    if (details.method === 'station') place += ' · ' + details.station;
    out.push(T.msgMethod + '：' + place);
    if (needsAddress(details.method)) out.push(T.msgAddress + '：' + fullAddress());
    out.push(T.msgDate + '：' + details.date + ' (' + weekdayOf(details.date) + ')');
    out.push(T.msgTime + '：' + details.time);
    return out;
  }

  /* ---------- address suggestions ---------- */

  /* The Hong Kong government's Address Lookup Service: free, keyless and
     bilingual. It is a bonus, never a dependency — if it is unreachable, slow
     or changes shape, the suggestion list simply stays empty and the district
     picker and address box below it remain the real input. */
  var ALS = 'https://www.als.ogcio.gov.hk/lookup';
  var alsAbort = null;

  function alsSearch(q, cb) {
    if (alsAbort) { try { alsAbort.abort(); } catch (e) {} alsAbort = null; }
    if (!window.fetch || !window.AbortController || q.length < 2) return cb([]);
    var ctl = new AbortController();
    alsAbort = ctl;
    fetch(ALS + '?q=' + encodeURIComponent(q) + '&n=6', {
      headers: { Accept: 'application/json' }, signal: ctl.signal
    })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) { cb(alsParse(j)); })
      .catch(function () { cb([]); });
  }

  function alsParse(j) {
    var out = [];
    try {
      (j && j.SuggestedAddress || []).forEach(function (s) {
        var pa = s && s.Address && s.Address.PremisesAddress;
        var a = pa && (isZH ? pa.ChiPremisesAddress : pa.EngPremisesAddress);
        if (!a) return;
        var dist = (a.ChiDistrict && a.ChiDistrict.DcDistrict) ||
                   (a.EngDistrict && a.EngDistrict.DcDistrict) || '';
        var st = a.ChiStreet || a.EngStreet || null;
        var bits = [];
        if (a.ChiEstate && a.ChiEstate.EstateName) bits.push(a.ChiEstate.EstateName);
        if (a.EngEstate && a.EngEstate.EstateName) bits.push(a.EngEstate.EstateName);
        if (st && st.StreetName) bits.push(isZH ? (st.StreetName + (st.BuildingNoFrom || ''))
                                               : ((st.BuildingNoFrom || '') + ' ' + st.StreetName));
        if (a.BuildingName) bits.push(a.BuildingName);
        var line = bits.filter(function (x) { return x; }).join(isZH ? '' : ', ').trim();
        if (line) out.push({ line: line, district: matchDistrict(dist) });
      });
    } catch (e) { return []; }
    return out.slice(0, 6);
  }

  // ALS names districts its own way ("沙田區", "SHA TIN DISTRICT"); map onto ours.
  function matchDistrict(name) {
    if (!name) return '';
    var n = String(name).toUpperCase().replace(/\s*DISTRICT\s*$/, '').trim();
    var hit = '';
    DISTRICTS.forEach(function (d) {
      if (hit) return;
      if (d[0] === name || d[0].replace('區', '') === String(name).replace('區', '')) hit = loc(d);
      else if (d[1].toUpperCase().replace(/[^A-Z]/g, '') === n.replace(/[^A-Z]/g, '')) hit = loc(d);
    });
    return hit;
  }

  /* ---------- WhatsApp message ---------- */

  function waLink() {
    var lines = [T.greet, ''];
    Object.keys(cart).forEach(function (id) {
      var p = catalog[id];
      lines.push('• ' + p.name + ' (' + unitLabel(p.unit) + ') × ' + cart[id] +
                 ' — $' + (p.price * cart[id]));
    });
    lines.push('', T.subtotal + '：$' + total(), '');
    return 'https://wa.me/' + WA_NUMBER + '?text=' +
           encodeURIComponent(lines.concat(detailLines()).join('\n'));
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
    if (n === 0) { disarmClear(); drawer.setAttribute('data-step', 'items'); }
    // the tier can change under the details step — re-offer what is earned now
    renderDetails();

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
    // an incomplete details form must not reach WhatsApp
    var go = e.target.closest && e.target.closest('.cart-checkout');
    if (go) {
      if (!go.classList.contains('is-off')) return;   // let the link do its job
      e.preventDefault();
      goStep('details');
      var dv = document.querySelector('#lstCart .dv');
      var err = dv && dv.querySelector('.dv-err');
      if (err) { err.hidden = false; err.textContent = problemText(detailsProblem(total())); }
      return;
    }

    var t = e.target.closest('[data-add],[data-inc],[data-dec],[data-cart-open],[data-cart-close],' +
                             '[data-cart-clear],[data-step-details],[data-step-items]');
    if (!t) return;

    if (t.hasAttribute('data-cart-open'))  { e.preventDefault(); openCart(); return; }
    if (t.hasAttribute('data-cart-close')) { e.preventDefault(); closeCart(); return; }
    if (t.hasAttribute('data-cart-clear')) { e.preventDefault(); onClear(t); return; }
    if (t.hasAttribute('data-step-details')) { e.preventDefault(); goStep('details'); return; }
    if (t.hasAttribute('data-step-items'))   { e.preventDefault(); goStep('items'); return; }

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
