# How the site is put together

Every page is plain HTML that GitHub Pages serves as-is. Nothing runs on the
server. The pages are **generated** on your own machine from the files in this
folder, so one fact lives in one place.

| You want to change…                     | Edit                      |
|-----------------------------------------|---------------------------|
| a flavour: name, price, notes, colour   | `tools/products.json`     |
| any other wording, in either language   | `tools/site.json`         |
| the layout of a page                    | `tools/templates/`        |
| how things look                         | `styles.css`              |
| how things move                         | `site.js`                 |
| how ordering works                      | `order.js`                |

After editing anything in `tools/`, run:

```
python3 tools/build.py --check     # shows what would change, writes nothing
python3 tools/build.py --write     # writes the pages
```

Then commit. Do not edit `index.html`, `en.html`, `404.html` or anything under
`products/` by hand — the next build would overwrite it.

## To add a flavour

1. Put the photo in `src/` (WebP, about 900px on its long edge).
2. Add one entry to `tools/products.json`. Copy the nearest existing flavour
   and change the values. `unit` is `jar` or `pcs` and decides which part of
   the menu it appears in.
3. Give it its colours, in `stage`:
   - `bg` — the flavour's colour: its menu tile, its page, the top of the
     homepage when it is on show
   - `ink` — the text on that colour; it must read clearly (aim for 4.5:1)
   - `soft` — a lighter tint of `bg`, the circle behind the picture
   - `deep` — a darker shade of `bg`
4. Cut the flavour out of its photo, so it can be shown large on colour:

   ```
   pip install "rembg[cpu]" pillow numpy scipy      # once
   python3 tools/cutout.py newflavour
   ```

   This writes `src/cut/newflavour.webp` and a half-size `-s.webp`. Look at
   the result before committing. If you skip this step the site still works:
   the flavour is shown as its ordinary photo in a round frame.
5. `python3 tools/build.py --write`, then commit.

That one entry produces: the flavour's two pages, its tile on both homepages,
its turn on the stage at the top, the "other flavours" rows, the search-engine
data, the sitemap, and its line in the order form.

## To change wording

`tools/site.json` holds every sentence that is not about one flavour, once
under `"zh"` and once under `"en"`. Change the text, build, commit. The
delivery stations drawn on the homepage are listed there too (`stations`); the
order form keeps its own copy in `order.js`, so change both together.

`stageStart` is the flavour the homepage opens on.

## What the build writes

`index.html`, `en.html`, `404.html`, `products/<id>.html` and
`products/<id>-en.html` for every flavour, `sitemap.xml`, and the `PRODUCTS`
list at the top of `order.js` (nothing else in that file is touched).

## Safety

The build refuses to run if a flavour's photo is missing, an id is used twice,
a `stage` colour is missing, or a template asks for wording that `site.json`
does not have. `--check` exits non-zero when anything on disk differs from
what the data says it should be.
