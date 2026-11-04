# Feature extract schema

`agent-app/extract.js` reads a product's website and turns what it finds into the feature list the demo planner uses. Nothing is typed by hand: every feature comes from a page we fetched.

Three steps:

1. `extractSite(startUrl, {maxPages})` fetches the start page, then follows links on the same site, nearest first, up to 25 pages. It skips `#` anchors, mail links, files such as images or scripts, and other sites.
2. `deriveFeatures(extract)` turns each page into one feature.
3. `toSchema(extract)` wraps the features as `{product, category, features}`, ready for `planDemo`.

## What we read from each page (PageExtract)

| Field | What it holds |
|---|---|
| url, path | Full address and the path part |
| title | The browser tab title |
| meta_description | The page's own description, if it has one |
| h1 | Main heading |
| headings | Every h1 to h4 with its level |
| nav | Links in the menu, sidebar or header, with the menu group they sit under |
| breadcrumbs | The "you are here" trail, split into parts |
| paragraphs | First 5 paragraphs, each cut to 240 characters |
| actions | Button texts that read as actions: Run, Approve, Request, Add, Export, Ask, and Spanish equivalents |
| forms | Each form with its fields (label, type, name) |
| inputs | Count of input boxes on the page, inside forms or not |
| tables | Each table: column names and number of rows |
| charts | How many pictures look like charts (drawn graphics, canvases, bar blocks) |
| numbers | Short sentences holding a number with %, x, days, hours, minutes, euros or dollars |
| data_feature | The page's own feature id, if it sets one on its main area |
| word_count | Words in the main area |

The whole crawl also returns `product` (site name from the page tags or the logo text), `start_url`, `crawled_at`, `pages`, `links_seen` and `errors`.

## How a page becomes a feature

| Field | Where it comes from |
|---|---|
| id | The page's own feature id, else a short name made from the file name |
| module | The menu group the page's link sits under (Finance, Talent...), else the first breadcrumb, else "General" |
| name | Main heading, else title |
| does | Description, else first paragraph, else the next headings |
| screen | Path from the site's base folder, such as `app/payroll.html` |
| themes | Up to 4 of cost, compliance, security, ease, speed, insight, integration, innovation, found by word lists in English and Spanish. A word in a heading, title or button counts three times as much as one in the body |
| roles | Same idea for finance, hr, manager, it, exec, employee |
| level | 1 to 3, from how busy the screen is: inputs, tables, charts and buttons |
| wow | 1 to 5: one for showing up, up to two for charts, one for AI words, one for a big effect number such as "38%" or "3x" |
| seconds | 30, 40 or 50, longer for busier screens |
| proof | The first number sentence long enough to read as a claim |
| evidence | Which words and counts produced each theme, role, level and wow |

Pages under 30 words are left out.

## Example (from the Kestrel payroll screen)

PageExtract, shortened:

```json
{"path": "/client-site/app/payroll.html", "title": "Payroll · Kestrel",
 "h1": "Payroll run · November 2026", "breadcrumbs": ["Payroll", "Pay date Fri 13 Nov"],
 "actions": ["Compare to October", "Approve and pay", "Fix", "Review", "Verify"],
 "tables": [{"columns": ["Worker","Country","Check","Amount","Severity",""], "rows": 3}],
 "charts": 1, "numbers": ["€4.82M", "+1.4% vs Oct"], "data_feature": "payroll", "word_count": 210}
```

Derived feature:

```json
{"id": "payroll", "module": "People", "name": "Payroll run · November 2026",
 "does": "Live checks. By country", "screen": "app/payroll.html",
 "roles": ["finance", "hr", "manager"], "themes": ["cost", "speed", "compliance"],
 "level": 2, "wow": 3, "seconds": 40,
 "evidence": ["roles.finance <- 'payroll' in h1 (weight 3)", "themes.speed <- 'live' in headings (weight 3)",
              "level 2 <- 0 inputs, 2 tables, 1 charts, 5 actions", "wow 3 <- 1 charts, 0 AI words, 1 big-effect numbers"]}
```
