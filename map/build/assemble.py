"""Assemble the final page: ASCII-safe template + inlined data.

The page must be pure ASCII so it renders correctly however it is served (a missing
UTF-8 charset previously produced "Fareham A. PO14 2LE"). HTML markup takes numeric
character references; the JS block takes \\uXXXX escapes. The split has to be by
POSITION, not by character membership, or HTML text ends up showing literal \\u2014.
"""
import os
import json

tpl = open("art/template.html", encoding="utf-8").read()
MARK = "<script>\n(function(){"
i = tpl.index(MARK)
head, tail = tpl[:i], tpl[i:]
head = "".join(c if ord(c) < 128 else "&#x%04X;" % ord(c) for c in head)
tail = "".join(c if ord(c) < 128 else "\\u%04X" % ord(c) for c in tail)
tpl = head + tail
assert all(ord(c) < 128 for c in tpl), "template still has non-ASCII"


def safe(s):
    return s.replace("<", "\\u003c").replace(">", "\\u003e").replace("&", "\\u0026")


html = (tpl.replace("__DATA__", safe(open("out/mapdata.json", encoding="utf-8").read()))
           .replace("__BASEMAP__", safe(open("out/uk_basemap.json", encoding="utf-8").read()))
           .replace("__PLACES__", safe(open("out/places_labels.json", encoding="utf-8").read())))
for slot in ("__DATA__", "__BASEMAP__", "__PLACES__"):
    assert slot not in html, slot
assert all(ord(c) < 128 for c in html)
assert "\\u2014" not in head, "em dash leaked into HTML as a JS escape"
open("art/opticians-map.html", "w", encoding="utf-8").write(html)
n = len(json.load(open("out/mapdata.json"))["rows"])
print("built art/opticians-map.html  %.2f MB  %d practices"
      % (os.path.getsize("art/opticians-map.html") / 1024 / 1024, n))
