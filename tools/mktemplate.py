# -*- coding: utf-8 -*-
"""Turn a real product page into a template, once.

The template is derived from the live site rather than retyped, so the page
chrome — head, nav, footer, script tags — stays exactly what every other page
already ships. build.py then only fills the holes punched here.

Regions are found by counting <div> depth rather than by matching an end
string: a literal end marker silently swallowed a neighbouring block the last
time this was done by regex, and duplicated a price panel across 14 pages.
"""
import re, io

SITE = 'https://www.littlesweettoothhk.com'
TAG = re.compile(r'<(/?)div\b', re.I)

def rd(p): return io.open(p, encoding='utf-8').read()

def block(s, start_marker, what):
    """Slice from start_marker to the </div> that closes it."""
    i = s.find(start_marker)
    assert i >= 0, f'{what}: not found'
    assert s.find(start_marker, i + 1) < 0, f'{what}: appears more than once'
    depth, pos = 0, i
    for m in TAG.finditer(s, i):
        depth += -1 if m.group(1) else 1
        if depth == 0:
            pos = s.index('>', m.end()) + 1
            return i, pos
    raise AssertionError(f'{what}: never closed')

def punch(s, start_marker, token, what):
    i, j = block(s, start_marker, what)
    return s[:i] + token + s[j:]

def build(src, pid):
    s = rd(src)

    # whole regions first, so the field substitutions below cannot reach inside
    k = s.find('<script type="application/ld+json">')
    e = s.find('</script>', k) + len('</script>')
    s = s[:k] + '{{JSONLD}}' + s[e:]

    for marker, token, what in [
        ('<div class="pd-stage">',        '{{GALLERY}}',    'gallery'),
        ('<div class="pp-notes-card">',   '{{NOTES_CARD}}', 'notes'),
        ('<div class="pp-prices-block">', '{{PRICES}}',     'prices'),
        ('<div class="pp-order pd-order"','{{ORDER}}',      'order'),
        ('<div class="pd-sticky"',        '{{STICKY}}',     'sticky'),
        ('<div class="pp-more-grid">',    '{{MORE_GRID}}',  'more grid'),
    ]:
        s = punch(s, marker, token, what)

    name = re.search(r'<h1 class="pp-title">([^<]*)</h1>', s).group(1)
    sub  = re.search(r'<div class="pp-subtitle">([^<]*)</div>', s).group(1)
    desc = re.search(r'<p class="pp-desc">([^<]*)</p>', s).group(1)
    eyeb = re.search(r'<div class="pp-eyebrow">(.*?)</div>', s, re.S).group(1)
    img  = re.search(rf'{re.escape(SITE)}/src/([^"]+)"', s).group(1)

    for literal, token in [
        # the meta description gets its own hole: Google truncates past ~155
        # characters, but the paragraph a customer reads should not be cut
        (f'<meta name="description" content="{desc}">',
         '<meta name="description" content="{{META_DESC}}">'),
        (desc, '{{DESC}}'),
        (f'{SITE}/products/{pid}-en.html', '{{URL_EN}}'),
        (f'{SITE}/products/{pid}.html',    '{{URL_ZH}}'),
        (f'{SITE}/src/{img}',              '{{IMG_ABS}}'),
        (f'<h1 class="pp-title">{name}</h1>',      '<h1 class="pp-title">{{NAME}}</h1>'),
        (f'<div class="pp-subtitle">{sub}</div>',  '<div class="pp-subtitle">{{SUB}}</div>'),
        (f'<div class="pp-eyebrow">{eyeb}</div>',  '<div class="pp-eyebrow">{{EYEBROW}}</div>'),
        (f'<title>{name} · Little Sweet Tooth</title>', '<title>{{NAME}} · Little Sweet Tooth</title>'),
        (f'content="{name} · Little Sweet Tooth"', 'content="{{NAME}} · Little Sweet Tooth"'),
        (f'href="{pid}-en.html"', 'href="{{ID}}-en.html"'),
        (f'href="{pid}.html"',    'href="{{ID}}.html"'),
    ]:
        s = s.replace(literal, token)

    for leak, what in ((name, 'name'), (desc, 'description'), (pid, 'id'), (img, 'image')):
        assert leak not in s, f'{src}: {what} still present in the template'
    return s

if __name__ == '__main__':
    for lang, src in (('zh', 'products/seasalt.html'), ('en', 'products/seasalt-en.html')):
        t = build(src, 'seasalt')
        io.open(f'tools/templates/product.{lang}.html', 'w', encoding='utf-8').write(t)
        holes = sorted(set(re.findall(r'\{\{[A-Z_]+\}\}', t)))
        print(f'  product.{lang}.html  {len(t):6} bytes   holes: {" ".join(holes)}')
