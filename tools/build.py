# -*- coding: utf-8 -*-
"""Build every page of the site from the data and templates in this folder.

    python3 tools/build.py --check    compare against what is on disk
    python3 tools/build.py --write    write the files
    python3 tools/build.py --diff     show what would change

What goes in:
    tools/products.json     the flavours: names, prices, notes, photo, colours
    tools/site.json         every other word on the site, in both languages
    tools/templates/        the page layouts (one layout serves both languages)
    src/cut/<id>.webp       each flavour cut out of its photo (tools/cutout.py)

What comes out: index.html, en.html, 404.html, two pages per flavour under
products/, sitemap.xml, and the PRODUCTS list at the top of order.js.

The site stays entirely static — this runs on your machine and commits plain
HTML. Nothing here executes on the server.
"""
import json, io, re, sys, os

SITE = 'https://www.littlesweettoothhk.com'
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TOKEN = re.compile(r'\{\{(>|@|t:)?([A-Za-z0-9_.]+)\}\}')
SECTIONS = ['home', 'menu', 'care', 'farewell', 'faq', 'contact']

def rd(p): return io.open(os.path.join(ROOT, p), encoding='utf-8').read()
def tpl(name): return rd(f'tools/templates/{name}.html').rstrip('\n')
def L(d, lang): return (d or {}).get(lang) or ''
def other(lang): return 'en' if lang == 'zh' else 'zh'
def code(lang): return 'zh-Hant' if lang == 'zh' else 'en'
def strip_tags(s): return re.sub(r'<[^>]+>', '', s)

def page_url(pid, lang):
    return f'products/{pid}.html' if lang == 'zh' else f'products/{pid}-en.html'

def webp_size(path):
    """Width and height of a WebP file, read straight from its header."""
    b = io.open(path, 'rb').read(40)
    kind = b[12:16]
    if kind == b'VP8X':
        return 1 + int.from_bytes(b[24:27], 'little'), 1 + int.from_bytes(b[27:30], 'little')
    if kind == b'VP8 ':
        return int.from_bytes(b[26:28], 'little') & 0x3fff, int.from_bytes(b[28:30], 'little') & 0x3fff
    if kind == b'VP8L':
        n = int.from_bytes(b[21:25], 'little')
        return 1 + (n & 0x3fff), 1 + ((n >> 14) & 0x3fff)
    raise ValueError(f'{path}: not a WebP file')

def render(text, ctx):
    """{{t:key}} a string · {{>name}} another template · {{@name}} a generated
       fragment · {{NAME}} a plain value. Anything unknown is an error."""
    def sub(m):
        kind, name = m.group(1), m.group(2)
        if kind == '>':  return render(tpl(name), ctx)
        if kind == 't:':
            assert name in ctx['t'], f'site.json has no "{name}" for {ctx["lang"]}'
            return ctx['t'][name]
        if kind == '@':
            assert name in ctx['frag'], f'no fragment called {name}'
            return ctx['frag'][name]()
        assert name in ctx['vars'], f'no value called {name}'
        return ctx['vars'][name]
    return TOKEN.sub(sub, text)

# ─────────────────────────── shared pieces ───────────────────────────

ICONS = json.loads(rd('tools/templates/icons.json'))
def icon(name):
    return f'<svg class="i i-fill" viewBox="0 0 24 24" aria-hidden="true"><path d="{ICONS[name]}"/></svg>'

def stage_vars(p):
    s = p['stage']
    return f'--s-bg:{s["bg"]};--s-ink:{s["ink"]};--s-soft:{s["soft"]};--s-deep:{s["deep"]}'

def cut(p):
    """The flavour's cut-out, if tools/cutout.py has made one."""
    path = os.path.join(ROOT, 'src', 'cut', p['id'] + '.webp')
    if not os.path.exists(path): return None
    w, h = webp_size(path)
    return {'big': f'src/cut/{p["id"]}.webp', 'small': f'src/cut/{p["id"]}-s.webp', 'w': w, 'h': h}

def shot(p, R, sizes, alt='', eager=False, cls=''):
    """An <img> of the flavour: its cut-out, or failing that its photo in a round frame."""
    c = cut(p)
    load = 'loading="eager" fetchpriority="high"' if eager else 'loading="lazy"'
    if not c:
        return (f'<img class="{(cls + " is-photo").strip()}" src="{R}src/{p["img"]}" alt="{alt}" '
                f'width="{p["imgW"]}" height="{p["imgH"]}" {load} decoding="async">')
    klass = f' class="{cls}"' if cls else ''
    return (f'<img{klass} src="{R}{c["small"]}" srcset="{R}{c["small"]} {c["w"] // 2}w, {R}{c["big"]} {c["w"]}w" '
            f'sizes="{sizes}" alt="{alt}" width="{c["w"]}" height="{c["h"]}" {load} decoding="async">')

def tile(p, lang, R, href, h, indent):
    """One flavour as a block of its own colour."""
    i = indent
    tag = f'\n{i}  <span class="tile-tag">{L(p["tag"], lang)}</span>' if L(p['tag'], lang) else ''
    return (
f'''{i}<article class="tile" data-product data-id="{p['id']}" data-unit="{p['unit']}" style="{stage_vars(p)}">
{i}  <div class="tile-shot">{shot(p, R, '(min-width: 1000px) 340px, 45vw')}</div>{tag}
{i}  <div class="tile-body">
{i}    <{h} class="tile-name"><a href="{href}">{L(p['name'], lang)}</a></{h}>
{i}    <p class="tile-sub" lang="{code(other(lang))}">{L(p['sub'], lang)}</p>
{i}    <p class="tile-price"><b>${p['price']}</b><span>{L(p['unitLabel'], lang)}</span></p>
{i}  </div>
{i}</article>''')

def rows(pairs, indent):
    return '\n'.join(f'{indent}<div><dt>{k}</dt><dd>{v}</dd></div>' for k, v in pairs)

def common(site, lang, R, H, other_href, products):
    t = site[lang]
    def nav(indent, wrap=None, numbered=False):
        out = []
        for n, s in enumerate(SECTIONS):
            a = f'<a href="{H}#{s}" data-nav="{s}">{t["nav." + s]}</a>'
            if numbered: a = f'<a href="{H}#{s}" data-nav="{s}"><small>0{n + 1}</small>{t["nav." + s]}</a>'
            out.append(indent + (f'<{wrap}>{a}</{wrap}>' if wrap else a))
        return '\n'.join(out)
    def strip():
        once = ''.join(f'<span>{s}</span><i aria-hidden="true"></i>' for s in t['strip'])
        return f'      <div class="strip-set">{once}</div>\n      <div class="strip-set" aria-hidden="true">{once}</div>'
    return {
        'strip': strip,
        'nav': lambda: nav('        '),
        'nav_sheet': lambda: nav('      ', numbered=True),
        'nav_foot': lambda: nav('            ', wrap='li'),
        'other_lang': lambda: code(other(lang)),
        'ig': lambda: site['links']['instagram'],
        'wa': lambda: site['links']['whatsapp'],
        'icon_ig': lambda: icon('ig'),
        'icon_wa': lambda: icon('wa'),
        'foot_info': lambda: '\n'.join(f'            <li>{x}</li>' for x in t['foot.info']),
        'preload': lambda: '',
        'count': lambda: str(len(products)),
    }

# ─────────────────────────── structured data ───────────────────────────

def offer(p, lang):
    url = f'{SITE}/{page_url(p["id"], lang)}'
    return {'@type': 'Offer', 'url': url, 'priceCurrency': 'HKD', 'price': p['price'],
            'availability': 'https://schema.org/InStock',
            'seller': {'@type': 'Organization', 'name': 'Little Sweet Tooth'}}

def product_record(p, lang, context=True):
    url = f'{SITE}/{page_url(p["id"], lang)}'
    d = {'@context': 'https://schema.org'} if context else {}
    d.update({'@type': 'Product', 'name': L(p['name'], lang), 'image': f'{SITE}/src/{p["img"]}',
              'description': L(p['desc'], lang),
              'brand': {'@type': 'Brand', 'name': 'Little Sweet Tooth'},
              'url': url, 'offers': offer(p, lang)})
    return d

def catalogue_offer(p, lang):
    """One Offer inside the homepage OfferCatalog. Every Product carries its
       own offers block — Search Console rejects Products without one."""
    url = f'{SITE}/{page_url(p["id"], lang)}'
    return {'@type': 'Offer', 'priceCurrency': 'HKD', 'price': p['price'],
            'availability': 'https://schema.org/InStock',
            'itemOffered': product_record(p, lang, context=False),
            'url': url, 'seller': {'@type': 'Organization', 'name': 'Little Sweet Tooth'}}

def ld(data):
    return ('  <script type="application/ld+json">\n'
            + json.dumps(data, ensure_ascii=False, indent=2) + '\n  </script>')

def home_ld(site, lang, products):
    bakery = json.loads(rd(f'tools/templates/ld.bakery.{lang}.json'))
    bakery['hasOfferCatalog']['itemListElement'] = [catalogue_offer(p, lang) for p in products]
    faq = {'@context': 'https://schema.org', '@type': 'FAQPage', 'mainEntity': [
        {'@type': 'Question', 'name': q, 'acceptedAnswer': {'@type': 'Answer', 'text': strip_tags(a)}}
        for q, a in site[lang]['faq']]}
    return ld(bakery) + '\n\n' + ld(faq)

# ─────────────────────────── pages ───────────────────────────

def render_home(site, products, lang):
    t = site[lang]
    by_id = {p['id']: p for p in products}
    start = site.get('stageStart') or products[0]['id']
    assert start in by_id, f'stageStart "{start}" is not a flavour'
    frag = common(site, lang, '', '', t['homeOther'], products)

    def stage_shots():
        p = by_id[start]
        return '          ' + shot(p, '', '(min-width: 900px) 46vw, 78vw', eager=True, cls='shot is-on').replace('<img ', f'<img data-id="{p["id"]}" ')

    def stage_panels():
        out = []
        for p in products:
            on = p['id'] == start
            tag = f'<p class="sp-tag">{L(p["tag"], lang)}</p>' if L(p['tag'], lang) else ''
            out.append(
f'''        <div class="sp{' is-on' if on else ''}" id="sp-{p['id']}" role="tabpanel" aria-labelledby="st-{p['id']}" data-product data-id="{p['id']}"{'' if on else ' hidden'}>
          {tag}
          <p class="sp-name">{L(p['name'], lang)}</p>
          <p class="sp-sub" lang="{code(other(lang))}">{L(p['sub'], lang)}</p>
          <div class="sp-row">
            <p class="sp-price"><b>${p['price']}</b><span>{L(p['unitLabel'], lang)}</span></p>
            <a class="sp-more" href="{page_url(p['id'], lang)}">{t['card.more']} <svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg></a>
          </div>
        </div>''')
        return '\n'.join(out)

    def stage_tabs():
        out = []
        for p in products:
            on, c, s = p['id'] == start, cut(p), p['stage']
            big = c['big'] if c else f'src/{p["img"]}'
            w, h = (c['w'], c['h']) if c else (p['imgW'], p['imgH'])
            out.append(
f'''          <button type="button" class="pick{' is-on' if on else ''}" role="tab" id="st-{p['id']}" aria-selected="{'true' if on else 'false'}" aria-controls="sp-{p['id']}" tabindex="{'0' if on else '-1'}" data-id="{p['id']}" data-bg="{s['bg']}" data-ink="{s['ink']}" data-soft="{s['soft']}" data-deep="{s['deep']}" data-cut="{big}" data-w="{w}" data-h="{h}"{'' if c else ' data-photo'} data-word="{L(p['name'], lang)}">
            {shot(p, '', '64px')}
            <span class="vh">{L(p['name'], lang)}</span>
          </button>''')
        return '\n'.join(out)

    def ticker():
        once = ''.join(f'<span>{s}</span><i aria-hidden="true"></i>' for s in t['trust'])
        return (f'      <div class="ticker-set">{once}</div>\n'
                + '\n'.join(f'      <div class="ticker-set" aria-hidden="true">{once}</div>' for _ in range(3)))

    def tiles(unit):
        picks = [p for p in products if p['unit'] == unit]
        assert picks, f'no {unit} products'
        return '\n'.join(tile(p, lang, '', page_url(p['id'], lang), 'h4', '          ') for p in picks)
    def duo(unit):
        return ' tiles--duo' if len([p for p in products if p['unit'] == unit]) <= 2 else ''

    def stations():
        out, col = [], 0 if lang == 'zh' else 1
        for s in site['stations']:
            home = s[0] == site['homeStation']
            here = f'<span class="st-here">{t["del.here"]}</span>' if home else ''
            out.append(f'            <li class="st{" is-home" if home else ""}" style="--i:{len(out)}"><span class="st-dot"></span>'
                       f'<span class="st-name">{s[col]}</span>{here}</li>')
        return '\n'.join(out)

    def fw_parade():
        return '\n'.join('      ' + shot(by_id[i], '', '(min-width: 900px) 220px, 34vw') for i, _ in t['fw.list'] if i in by_id)

    def fw_list():
        return '\n'.join(f'          <li>{shot(by_id[i], "", "44px") if i in by_id else ""}<span>{name}</span></li>'
                         for i, name in t['fw.list'])

    def faq():
        return '\n'.join(
f'''        <details class="qa" data-reveal>
          <summary>{q}</summary>
          <div class="qa-a">{a}</div>
        </details>''' for q, a in t['faq'])

    c0 = cut(by_id[start])
    frag.update({
        'preload': lambda: (f'\n  <link rel="preload" as="image" href="{c0["small"]}" imagesrcset="{c0["small"]} {c0["w"] // 2}w, {c0["big"]} {c0["w"]}w" '
                            f'imagesizes="(min-width: 900px) 46vw, 78vw" fetchpriority="high">') if c0 else '',
        'home_ld': lambda: home_ld(site, lang, products),
        'stage_shots': stage_shots, 'stage_panels': stage_panels, 'stage_tabs': stage_tabs,
        'ticker': ticker, 'tiles_jar': lambda: tiles('jar'), 'tiles_pcs': lambda: tiles('pcs'),
        'duo_jar': lambda: duo('jar'), 'duo_pcs': lambda: duo('pcs'),
        'stations': stations, 'fw_parade': fw_parade, 'fw_list': fw_list,
        'fw_rows': lambda: rows(t['fw.rows'], '          '),
        'contact_rows': lambda: rows(t['contact.rows'], '          '),
        'faq': faq,
    })
    ctx = {'lang': lang, 't': t, 'frag': frag, 'vars': {'R': '', 'H': '', 'OTHER': t['homeOther']}}
    s = by_id[start]['stage']
    body = render(tpl('body.home'), ctx).replace(
        '<body class="home">', f'<body class="home" style="{stage_vars(by_id[start])}">', 1)
    return (f'<!DOCTYPE html>\n<html lang="{t["lang"]}">\n' + render(tpl(f'head.home.{lang}'), ctx) + '\n' + body + '\n')

def render_product_page(site, products, idx, lang):
    p, t = products[idx], site[lang]
    R, H = '../', f'../{t["home"]}'
    name = L(p['name'], lang)
    other_href = f'{p["id"]}-en.html' if lang == 'zh' else f'{p["id"]}.html'
    frag = common(site, lang, R, H, other_href, products)
    c = cut(p)
    tag = f'\n        <span class="tile-tag">{L(p["tag"], lang)}</span>' if L(p['tag'], lang) else ''
    others = [products[(idx + k) % len(products)] for k in range(1, 5)]
    order = (f'<div class="pp-order" data-product data-id="{p["id"]}"></div>')
    frag.update({
        'preload': lambda: (f'\n  <link rel="preload" as="image" href="{R}{c["big"]}" fetchpriority="high">') if c else '',
        'product_ld': lambda: ld(product_record(p, lang)),
        'stage_style': lambda: stage_vars(p),
        'word': lambda: ''.join(f'<span>{name}</span>' for _ in range(6)),
        'pshot': lambda: '        ' + shot(p, R, '(min-width: 900px) 44vw, 78vw', alt=name, eager=True, cls='shot') + tag,
        'price': lambda: f'${p["price"]}',
        'unit': lambda: L(p['unitLabel'], lang),
        'order': lambda: order,
        'photo': lambda: (f'        <img src="{R}src/{p["img"]}" alt="{name}" width="{p["imgW"]}" height="{p["imgH"]}" '
                          f'loading="lazy" decoding="async">'),
        'notes': lambda: '\n'.join(f'          <li>{n}</li>' for n in L(p['notes'], lang)),
        'more': lambda: '\n'.join(tile(o, lang, R, f'{o["id"]}.html' if lang == 'zh' else f'{o["id"]}-en.html', 'h3', '        ')
                                  for o in others),
        'buybar': lambda: (f'<div class="buybar" data-product data-id="{p["id"]}">\n'
                           f'    <p class="buybar-price"><span>{L(p["unitLabel"], lang)}</span><b>${p["price"]}</b></p>\n'
                           f'  </div>'),
    })
    ctx = {'lang': lang, 't': t, 'frag': frag, 'vars': {
        'R': R, 'H': H, 'OTHER': other_href, 'NAME': name, 'SUB': L(p['sub'], lang),
        'DESC': L(p['desc'], lang), 'META_DESC': L(p.get('metaDesc') or {}, lang) or L(p['desc'], lang),
        'URL_ZH': f'{SITE}/products/{p["id"]}.html', 'URL_EN': f'{SITE}/products/{p["id"]}-en.html',
        'IMG_ABS': f'{SITE}/src/{p["img"]}', 'ID': p['id']}}
    return (f'<!DOCTYPE html>\n<html lang="{t["lang"]}">\n' + render(tpl(f'head.product.{lang}'), ctx)
            + '\n' + render(tpl('body.product'), ctx) + '\n')

def render_404(site, products):
    """Served for any missing address, at any depth — so every path in it is absolute."""
    t = site['zh']
    frag = common(site, 'zh', '/', '/', '/en.html', products)
    ctx = {'lang': 'zh', 't': t, 'frag': frag, 'vars': {'R': '/', 'H': '/', 'OTHER': '/en.html'}}
    return (f'<!DOCTYPE html>\n<html lang="{t["lang"]}">\n' + render(tpl('head.404'), ctx)
            + '\n' + render(tpl('body.404'), ctx) + '\n')

def render_sitemap(products):
    """Product entries are listed alphabetically by id, Chinese then English,
       each carrying the hreflang pair for its own flavour."""
    s = rd('sitemap.xml')
    head = s[:re.search(r'  <url>\n    <loc>[^<]*/products/', s).start()]
    entries = []
    for p in sorted(products, key=lambda x: x['id']):
        zh, en = f'{SITE}/products/{p["id"]}.html', f'{SITE}/products/{p["id"]}-en.html'
        for loc, pri in ((zh, '0.8'), (en, '0.7')):
            entries.append(
                f'  <url>\n'
                f'    <loc>{loc}</loc>\n'
                f'    <xhtml:link rel="alternate" hreflang="zh-Hant" href="{zh}"/>\n'
                f'    <xhtml:link rel="alternate" hreflang="en" href="{en}"/>\n'
                f'    <changefreq>monthly</changefreq>\n'
                f'    <priority>{pri}</priority>\n'
                f'  </url>\n')
    return head + ''.join(entries) + '</urlset>\n'

def render_order_js(products):
    """Keep the hand-aligned columns. Chinese names occupy two cells each in a
       fixed-width editor, so pad on display width rather than character count."""
    def w(t): return sum(2 if ord(c) > 0x2E80 else 1 for c in t)
    def pad(t, target): return t + ' ' * max(1, target - w(t))

    s = rd('order.js')
    i = s.index('  var PRODUCTS = [')
    j = s.index('  ];', i) + len('  ];')

    ids  = [f"id: '{p['id']}'," for p in products]
    zhs  = [f"zh: '{L(p['name'], 'zh')}'," for p in products]
    ens  = [f"en: '{L(p['name'], 'en')}'," for p in products]
    cid, czh, cen = (max(w(x) for x in col) + 1 for col in (ids, zhs, ens))

    lines = ['  var PRODUCTS = [']
    for n, p in enumerate(products):
        lines.append('    { ' + pad(ids[n], cid) + pad(zhs[n], czh) + pad(ens[n], cen)
                     + f"price: {p['price']}, unit: '{p['unit']}', img: '{p['img']}' }}"
                     + (',' if n < len(products) - 1 else ''))
    lines.append('  ];')
    return s[:i] + '\n'.join(lines) + s[j:]

# ─────────────────────────── driver ───────────────────────────

def render_all():
    products = json.loads(rd('tools/products.json'))
    site = json.loads(rd('tools/site.json'))
    ids = [p['id'] for p in products]
    assert len(set(ids)) == len(ids), 'duplicate product id'
    for p in products:
        assert os.path.exists(os.path.join(ROOT, 'src', p['img'])), f'{p["id"]}: src/{p["img"]} is missing'
        assert set(p['stage']) >= {'bg', 'ink', 'soft', 'deep'}, f'{p["id"]}: stage needs bg, ink, soft and deep'

    files = {}
    for idx, p in enumerate(products):
        for lang in ('zh', 'en'):
            files[page_url(p['id'], lang)] = render_product_page(site, products, idx, lang)
    for lang in ('zh', 'en'):
        files[site[lang]['home']] = render_home(site, products, lang)
    files['404.html'] = render_404(site, products)
    files['sitemap.xml'] = render_sitemap(products)
    files['order.js'] = render_order_js(products)
    for name, body in files.items():
        left = TOKEN.findall(body) if name.endswith('.html') else []
        assert not left, f'{name}: unfilled {left[:3]}'
    return files

def main(argv):
    write = '--write' in argv
    files = render_all()
    same, diff = [], []
    for name, body in sorted(files.items()):
        path = os.path.join(ROOT, name)
        old = io.open(path, encoding='utf-8').read() if os.path.exists(path) else None
        (same if old == body else diff).append(name)
        if write and old != body:
            io.open(path, 'w', encoding='utf-8').write(body)

    print(f'  {len(same)} file(s) already identical')
    for n in diff:
        print(f'  {"WROTE" if write else "DIFFERS"}  {n}')
    if not write and diff:
        print('\n  run with --write to apply, or --diff to see what changed')
        return 1
    print('\n  ok')
    return 0

if __name__ == '__main__':
    if '--diff' in sys.argv:
        import difflib
        for name, body in sorted(render_all().items()):
            path = os.path.join(ROOT, name)
            old = io.open(path, encoding='utf-8').read() if os.path.exists(path) else ''
            if old != body:
                print(f'\n===== {name} =====')
                for line in list(difflib.unified_diff(old.splitlines(), body.splitlines(),
                                                      'on disk', 'generated', lineterm='', n=1))[:40]:
                    print('  ' + line[:160])
        sys.exit(0)
    sys.exit(main(sys.argv))
