#!/usr/bin/env python3
"""build-data.py — render data/apis.json into docs/play/data.js.

One direction only: the JSON is the record, the JS is the bundle. The app cannot
fetch a file from file://, so the dataset has to be a script — and a script that
was hand-edited would drift from the record it claims to be. So it is generated,
and `node test-node.js` asserts the two agree entry for entry.
"""
import json, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
SRC = os.path.join(ROOT, "data", "apis.json")
DST = os.path.join(ROOT, "docs", "play", "data.js")


def main():
    with open(SRC, encoding="utf-8") as f:
        data = json.load(f)
    meta = data["meta"]
    head = (
        "/* data.js — GENERATED from data/apis.json by tools/build-data.py. Do not edit.\n"
        " *\n"
        " * source: %s\n"
        " * licence: %s\n"
        " * fetched: %s\n"
        " * entries: %d\n"
        " */\n" % (meta["source"], meta["licence"], meta["fetched"], meta["count"])
    )
    body = "window.ENDPOINTS_DATA = " + json.dumps(data, ensure_ascii=False, separators=(",", ":")) + ";\n"
    with open(DST, "w", encoding="utf-8") as f:
        f.write(head + body)
    print("wrote %s (%d bytes, %d entries)" % (DST, len(head) + len(body), len(data["apis"])))


if __name__ == "__main__":
    main()
