# Adding or changing a flavour

Everything about the product list is generated from **`tools/products.json`**.
The site stays completely static — these scripts run on your machine and write
plain HTML that you commit. Nothing here runs on the server.

## To add a flavour

1. Put the photo in `src/`.
2. Add one entry to `tools/products.json` (copy the nearest existing flavour and
   edit it — every field is required except `ppTag`, `homeTag`, `placeholder`
   and `frameStyle`, which may be empty).
3. Run:

   ```sh
   python3 tools/build.py --check    # show what would change
   python3 tools/build.py --write    # apply it
   ```

4. Commit. GitHub Pages serves the result as usual.

## What it writes

| File | What is regenerated |
|---|---|
| `products/<id>.html`, `<id>-en.html` | the two product pages |
| `index.html`, `en.html` | both shelves and the JSON-LD offer catalogue |
| every `products/*.html` | the “other flavours” grid at the foot |
| `sitemap.xml` | one entry per page, per language |
| `order.js` | the `PRODUCTS` list the cart runs on |

Only files whose content actually changes are touched.

## Ordering

`products.json` order is the catalogue order — it drives the shelves and the
“next four, wrapping” rule for related flavours. `unit` decides which shelf a
flavour lands on: `jar` or `pcs`.

## Safety

`build.py` regenerates the **whole** site, not just the new flavour, so
`--check` on an unchanged `products.json` must report every file identical. If
it does not, something has drifted and the diff will show exactly what — run
`python3 tools/build.py --diff`.

`tools/mktemplate.py` rebuilds `tools/templates/` from `products/seasalt.html`.
Only run it if you deliberately change the shape of a product page; it takes
whatever that page currently looks like as the new shape for all of them.
