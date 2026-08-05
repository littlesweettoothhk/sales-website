# -*- coding: utf-8 -*-
"""Regenerate everything that depends on the product list.

    python3 tools/build.py --check    compare against what is on disk
    python3 tools/build.py --write    write the files

tools/products.json is the single source of truth. Adding a flavour means one
entry there plus its photo in src/; this writes the two product pages, both
homepage shelves, the JSON-LD catalogue on both homepages, the related-flavour
grids on every product page, the sitemap, and the PRODUCTS list in order.js.

The site stays entirely static — this runs on your machine and commits plain
HTML. Nothing here executes on the server.
"""
import json, io, re, sys, os

SITE = 'https://www.littlesweettoothhk.com'
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TAG = re.compile(r'<(/?)div\b', re.I)

def rd(p): return io.open(os.path.join(ROOT, p), encoding='utf-8').read()
def L(d, lang): return d[lang]

def block(s, marker, what):
    i = s.find(marker)
    assert i >= 0, f'{what}: not found'
    depth = 0
    for m in TAG.finditer(s, i):
        depth += -1 if m.group(1) else 1
        if depth == 0:
            return i, s.index('>', m.end()) + 1
    raise AssertionError(f'{what}: never closed')

def replace_block(s, marker, new, what):
    i, j = block(s, marker, what)
    return s[:i] + new + s[j:]

# ─────────────────────────── fragments ───────────────────────────

def page_url(pid, lang):
    return f'products/{pid}.html' if lang == 'zh' else f'products/{pid}-en.html'

def shelf_card(p, lang, indent='        '):
    """One flavour on a homepage shelf."""
    i = indent
    cls = 'sc is-featured' if p['featured'] else 'sc'
    tag = ''
    if L(p['homeTag'], lang):
        tag = f'<span class="{p["homeTagClass"]}">{L(p["homeTag"], lang)}</span>'
    return (
f'''{i}<article class="{cls}" data-product data-id="{p['id']}" data-name="{L(p['name'], lang)}" data-price="{p['price']}" data-unit="{p['unit']}" data-img="./src/{p['img']}" data-url="{page_url(p['id'], lang)}" data-sub="{L(p['sub'], lang)}" data-price-label="{L(p['homePriceLabel'], lang)}" data-price-text="${p['price']}" data-more="{L(p['homeMore'], lang)}" data-desc="{L(p['desc'], lang)}">
{i}  <button type="button" class="sc-open" aria-haspopup="dialog">
{i}    <span class="sc-frame"{L(p['frameStyle'], lang)}>{tag}{L(p['framePlaceholder'], lang)}<img src="./src/{p['img']}" alt="{L(p['homeAlt'], lang)}" width="{p['imgW']}" height="{p['imgH']}" loading="lazy" decoding="async"><span class="sc-peek">{L(p['peek'], lang)}</span></span>
{i}  </button>
{i}  <div class="sc-body">
{i}    <div class="sc-name" lang="{'zh-Hant' if lang == 'zh' else 'en'}">{L(p['name'], lang)}</div>
{i}    <div class="sc-sub" lang="{'en' if lang == 'zh' else 'zh-Hant'}">{L(p['sub'], lang)}</div>
{i}    <div class="sc-price"><span class="sc-lbl">{L(p['homePriceLabel'], lang)}</span><span class="sc-val">${p['price']}</span></div>
{i}    <a class="sc-more" href="{page_url(p['id'], lang)}">{L(p['homeMore'], lang)}</a>
{i}  </div>
{i}</article>''')

def catalogue_offer(p, lang):
    """One Offer inside the homepage OfferCatalog. Every Product carries its
       own offers block — Search Console rejects Products without one."""
    url = f'{SITE}/{page_url(p["id"], lang)}'
    return {
        '@type': 'Offer', 'priceCurrency': 'HKD', 'price': p['price'],
        'availability': 'https://schema.org/InStock',
        'itemOffered': {
            '@type': 'Product', 'name': L(p['name'], lang),
            'image': f'{SITE}/src/{p["img"]}', 'description': L(p['desc'], lang),
            'brand': {'@type': 'Brand', 'name': 'Little Sweet Tooth'},
            'url': url,
            'offers': {'@type': 'Offer', 'url': url, 'priceCurrency': 'HKD',
                       'price': p['price'], 'availability': 'https://schema.org/InStock',
                       'seller': {'@type': 'Organization', 'name': 'Little Sweet Tooth'}},
        },
        'url': url,
        'seller': {'@type': 'Organization', 'name': 'Little Sweet Tooth'},
    }

def product_ld(p, lang):
    url = f'{SITE}/{page_url(p["id"], lang)}'
    return {
        '@context': 'https://schema.org', '@type': 'Product',
        'name': L(p['name'], lang), 'image': f'{SITE}/src/{p["img"]}',
        'description': L(p['desc'], lang),
        'brand': {'@type': 'Brand', 'name': 'Little Sweet Tooth'},
        'offers': {'@type': 'Offer', 'url': url, 'priceCurrency': 'HKD',
                   'price': p['price'], 'availability': 'https://schema.org/InStock',
                   'seller': {'@type': 'Organization', 'name': 'Little Sweet Tooth'}},
    }

def more_card(p, lang, indent='          '):
    """One 'other flavours' card at the foot of a product page."""
    i = indent
    href = f'{p["id"]}.html' if lang == 'zh' else f'{p["id"]}-en.html'
    return (
f'''{i}<article class="product-card" data-product data-id="{p['id']}" data-name="{L(p['name'], lang)}" data-price="{p['price']}" data-unit="{p['unit']}" data-img="../src/{p['img']}" data-url="{page_url(p['id'], lang)}">
{i}  <a class="menu-card-link" href="{href}">
{i}    <div class="pc-img-wrap">
{i}      <img src="../src/{p['img']}" alt="{L(p['name'], lang)}" width="900" height="900" loading="lazy" decoding="async">
{i}    </div>
{i}    <div class="pc-body">
{i}      <div class="pc-title-main">{L(p['name'], lang)}</div>
{i}      <div class="pc-title-sub">{L(p['sub'], lang)}</div>
{i}      <div class="pc-prices">
{i}        <div class="pc-price"><span class="pc-p-lbl">{L(p['unitLabel'], lang)}</span><span class="pc-p-val">${p['price']}</span></div>
{i}      </div>
{i}      <span class="pc-cta">{L(p['moreCta'], lang)}</span>
{i}    </div>
{i}  </a>
{i}</article>''')

# ─────────────────────────── whole files ───────────────────────────

def render_product_page(products, idx, lang):
    p = products[idx]
    t = rd(f'tools/templates/product.{lang}.html')

    gallery = ['<div class="pd-stage">']
    if L(p['ppTag'], lang):
        gallery.append(f'            <span class="pp-tag">{L(p["ppTag"], lang)}</span>')
    gallery.append('            <div class="pd-track">')
    gallery.append(f'              <figure class="pd-slide"><img src="../src/{p["img"]}" '
                   f'alt="{L(p["slideAlt"], lang)}" width="{p["imgW"]}" height="{p["imgH"]}" '
                   f'loading="eager" decoding="async">{L(p["placeholder"], lang)}</figure>')
    gallery += ['            </div>', '          </div>']

    notes = [f'<div class="pp-notes-card">',
             f'            <div class="pp-notes-title">{L(p["notesTitle"], lang)}</div>',
             f'            <ul class="pp-notes">']
    notes += [f'          <li>{n}</li>' for n in L(p['notes'], lang)]
    notes += ['            </ul>', '          </div>']

    prices = ['<div class="pp-prices-block">',
              f'            <div class="pp-price-row"><span class="pp-p-lbl">{L(p["unitLabel"], lang)}</span>'
              f'<span class="pp-p-val">${p["price"]}</span></div>',
              '          </div>']

    order = (f'<div class="pp-order pd-order" data-product data-id="{p["id"]}" '
             f'data-name="{L(p["name"], lang)}" data-price="{p["price"]}" data-unit="{p["unit"]}" '
             f'data-img="../src/{p["img"]}" data-url="{page_url(p["id"], lang)}"></div>')

    sticky = (f'<div class="pd-sticky" data-id="{p["id"]}">\n'
              f'        <span class="pds-price"><span class="sc-lbl">{L(p["unitLabel"], lang)}</span>'
              f'<span class="sc-val">${p["price"]}</span></span>\n'
              f'        <span class="pds-act"></span>\n'
              f'      </div>')

    others = [products[(idx + k) % len(products)] for k in range(1, 5)]
    grid = '<div class="pp-more-grid">\n' + '\n'.join(more_card(o, lang) for o in others) + '\n        </div>'

    ld = ('<script type="application/ld+json">\n'
          + json.dumps(product_ld(p, lang), ensure_ascii=False, indent=2)
          + '\n  </script>')

    for token, value in [
        ('{{JSONLD}}', ld), ('{{GALLERY}}', '\n'.join(gallery)),
        ('{{NOTES_CARD}}', '\n'.join(notes)), ('{{PRICES}}', '\n'.join(prices)),
        ('{{ORDER}}', order), ('{{STICKY}}', sticky), ('{{MORE_GRID}}', grid),
        ('{{NAME}}', L(p['name'], lang)), ('{{SUB}}', L(p['sub'], lang)),
        ('{{DESC}}', L(p['desc'], lang)), ('{{EYEBROW}}', L(p['eyebrow'], lang)),
        ('{{URL_ZH}}', f'{SITE}/products/{p["id"]}.html'),
        ('{{URL_EN}}', f'{SITE}/products/{p["id"]}-en.html'),
        ('{{IMG_ABS}}', f'{SITE}/src/{p["img"]}'), ('{{ID}}', p['id']),
    ]:
        t = t.replace(token, value)
    left = re.findall(r'\{\{[A-Z_]+\}\}', t)
    assert not left, f'{p["id"]}.{lang}: unfilled {left}'
    return t

def render_home(products, lang):
    """Patch the two shelves and the JSON-LD catalogue into the homepage."""
    src = 'index.html' if lang == 'zh' else 'en.html'
    s = rd(src)

    for unit in ('jar', 'pcs'):
        picks = [p for p in products if p['unit'] == unit]
        assert picks, f'no {unit} products'
        first = picks[0]['id']
        i = s.index(f'data-product data-id="{first}"')
        art = s.rindex('<article', 0, i)
        start = s.rindex('\n', 0, art) + 1
        # the shelf ends at its grid's closing tag
        end = s.index('</div>', s.rindex('</article>', 0, s.index('<div class="shelf-plank"', i)))
        cards = '\n'.join(shelf_card(p, lang) for p in picks)
        s = s[:start] + cards + '\n      ' + s[end:]

    k = s.find('<script type="application/ld+json">')
    e = s.find('</script>', k)
    d = json.loads(s[k + len('<script type="application/ld+json">'):e])
    d['hasOfferCatalog']['itemListElement'] = [catalogue_offer(p, lang) for p in products]
    body = json.dumps(d, ensure_ascii=False, indent=2)
    s = s[:k] + '<script type="application/ld+json">\n' + body + '\n  ' + s[e:]
    return src, s

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
    return 'sitemap.xml', head + ''.join(entries) + '</urlset>\n'


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
    return 'order.js', s[:i] + '\n'.join(lines) + s[j:]


# ─────────────────────────── driver ───────────────────────────

def render_all():
    products = json.loads(rd('tools/products.json'))
    ids = [p['id'] for p in products]
    assert len(set(ids)) == len(ids), 'duplicate product id'
    for p in products:
        assert os.path.exists(os.path.join(ROOT, 'src', p['img'])), f'{p["id"]}: src/{p["img"]} is missing'

    files = {}
    for idx, p in enumerate(products):
        for lang in ('zh', 'en'):
            files[page_url(p['id'], lang)] = render_product_page(products, idx, lang)
    for lang in ('zh', 'en'):
        name, body = render_home(products, lang)
        files[name] = body
    for name, body in (render_sitemap(products), render_order_js(products)):
        files[name] = body
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
