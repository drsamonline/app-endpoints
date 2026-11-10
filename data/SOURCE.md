# The dataset — where it came from and what it may be used for

**File:** `data/apis.json` (2,214 entries) · **Bundled copy:** `docs/play/data.js`, generated
from the JSON by `tools/build-data.py` — never edited by hand, and `node test-node.js`
fails if the two disagree.

## Source

- **What:** the public API directory table from **public-apis/public-apis**
- **Where:** <https://github.com/public-apis/public-apis> — the README table
- **Fetched:** 2026-11-10 from
  <https://raw.githubusercontent.com/public-apis/public-apis/master/README.md>
- **Fetched by:** the Forge cycle's `app-endpoints` build

## Licence — of the DATA, not of this app

**MIT.** The repository's own licence file covers its contents, and the list itself is
reproduced here with that notice intact. This app is PolyForm Noncommercial 1.0.0; the
dataset is MIT and carries its own terms, which is why they are recorded separately.

```
The MIT License (MIT)

Copyright (c) 2016 David FF

Permission is hereby granted, free of charge, to any person obtaining a copy of this
software and associated documentation files (the "Software"), to deal in the Software
without restriction, including without limitation the rights to use, copy, modify,
merge, publish, distribute, sublicense, and/or sell copies of the Software, and to
permit persons to whom the Software is furnished to do so, subject to the following
conditions:

The above copyright notice and this permission notice shall be included in all copies
or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED,
INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A
PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT
HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF
CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR
THE USE OR OTHER DEALINGS IN THE SOFTWARE.
```

## Curation — what was changed, and why

The upstream table is reproduced with these mechanical changes only. Nothing was added:

| Change | Count | Why |
| --- | --- | --- |
| One row per (name, host) | 7 dropped | the same API listed twice adds nothing to a search result |
| Rows whose **CORS** cell is not `Yes` / `No` / `Unknown` | 41 dropped | these are advertising or MCP-directory cells in the CORS column, not CORS answers; keeping them would have meant inventing one |
| `auth` normalised | all | `No` → `none`, `apiKey` → `apiKey`, `OAuth` → `OAuth`, anything else (`X-Mashape-Key`, `User-Agent`) → `other` |
| `https` normalised | all | `Yes` / `No` only |
| `id` added | all | `<host>/<slug>` — stable across a re-fetch unless the host changes |
| `cat` taken from the section heading | all | the table's own grouping |

**No free-tier terms are recorded, because the source does not state them.** The app says
"listed as free in public-apis" and links out; it does not invent pricing, rate limits or
quotas, and it does not claim an API is still free today. The fetch date is the only
currency claim it makes.

## What is NOT here

- No OpenAPI definitions (the CC0 `APIs-guru/openapi-directory` is 766 MB and was not
  bundled; the app links to documentation instead).
- No uptime, latency or health data. This is a directory, not a monitor.
- No API keys. The app never asks for one.
