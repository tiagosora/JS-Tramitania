"""Monta Tramitania.html (jogável no browser e importável no Twine 2) a partir de
passagens.twee, story.js e story.css, com o formato SugarCube 2.37.3 do Twine."""
import html, json, re, sys
from pathlib import Path

ROOT = Path(__file__).parent
IFID = "8E2C4A1B-6F3D-4B7A-9C55-2A7D1E0F3B64"
NAME = "Tramitânia"
START = "Inicio"

def parse_twee(text):
    """Twee 3: «:: Nome [etiquetas] {"position": "x,y", "size": "w,h"}»."""
    passages, cur = [], None
    for line in text.split("\n"):
        m = re.match(r"^:: (.+?)(?: \[([^\]]*)\])?(?: (\{.*\}))?\s*$", line)
        if m:
            cur = {"name": m.group(1).strip(), "tags": (m.group(2) or "").split(),
                   "meta": json.loads(m.group(3)) if m.group(3) else {}, "lines": []}
            passages.append(cur)
        elif cur is not None:
            cur["lines"].append(line)
    for p in passages:
        p["text"] = "\n".join(p["lines"]).strip("\n")
    return passages

def build(out):
    fmt = (ROOT / "vendor/sugarcube-2.37.3-format.js").read_text(encoding="utf-8")
    fmt = json.loads(fmt[fmt.index("(") + 1 : fmt.rindex(")")])
    allp = parse_twee((ROOT / "passagens.twee").read_text(encoding="utf-8"))
    sd = next((json.loads(p["text"]) for p in allp if p["name"] == "StoryData"), {})
    passages = [p for p in allp if p["name"] not in ("StoryTitle", "StoryData")]
    names = [p["name"] for p in passages]
    assert len(names) == len(set(names)), "nomes de passagem repetidos"
    assert START in names
    pd = []
    for i, p in enumerate(passages, 1):
        pos = p["meta"].get("position") or f'{100 + (i - 1) % 8 * 175},{100 + (i - 1) // 8 * 175}'
        size = p["meta"].get("size", "100,100")
        pd.append(f'<tw-passagedata pid="{i}" name="{html.escape(p["name"])}" tags="{html.escape(" ".join(p["tags"]))}" '
                  f'position="{pos}" size="{size}">{html.escape(p["text"])}</tw-passagedata>')
    tagcolors = "".join(f'<tw-tag name="{html.escape(k)}" color="{html.escape(v)}"></tw-tag>'
                        for k, v in sd.get("tag-colors", {}).items())
    js = (ROOT / "story.js").read_text(encoding="utf-8")
    css = (ROOT / "story.css").read_text(encoding="utf-8")
    assert "</script" not in js and "</style" not in css
    data = (f'<tw-storydata name="{NAME}" startnode="{names.index(sd.get("start", START)) + 1}" creator="Twine" creator-version="2.10.0" '
            f'format="SugarCube" format-version="{fmt["version"]}" ifid="{IFID}" options="" tags="" zoom="{sd.get("zoom", 1)}" hidden>'
            f'<style role="stylesheet" id="twine-user-stylesheet" type="text/twine-css">{css}</style>'
            f'<script role="script" id="twine-user-script" type="text/twine-javascript">{js}</script>'
            + tagcolors + "".join(pd) + "</tw-storydata>")
    page = fmt["source"].replace("{{STORY_NAME}}", html.escape(NAME)).replace("{{STORY_DATA}}", data)
    Path(out).write_text(page, encoding="utf-8")
    print(f"{out}: {len(passages)} passagens, {len(page) // 1024} KB")

TWINE_LIB = Path.home() / "Documents/Twine/Stories"

def extract(src):
    """Lê uma história do Twine (ficheiro da biblioteca ou publicado) e reescreve
    passagens.twee, story.js e story.css, para os testes correrem sobre essa versão."""
    page = Path(src).read_text(encoding="utf-8")
    m = re.search(r"<tw-storydata\b[^>]*>(.*?)</tw-storydata>", page, re.S)
    assert m, f"{src} não tem uma história do Twine"
    body = m.group(1)
    css = re.search(r'<style[^>]*type="text/twine-css"[^>]*>(.*?)</style>', body, re.S)
    js = re.search(r'<script[^>]*type="text/twine-javascript"[^>]*>(.*?)</script>', body, re.S)
    sdattrs = dict(re.findall(r'([\w-]+)="([^"]*)"', re.search(r"<tw-storydata\b([^>]*)>", page).group(1)))
    pids = {a.get("pid"): html.unescape(a["name"]) for a in
            (dict(re.findall(r'(\w+)="([^"]*)"', x)) for x in re.findall(r"<tw-passagedata\b([^>]*)>", body))}
    sd = {"ifid": sdattrs.get("ifid", IFID), "format": sdattrs.get("format", "SugarCube"),
          "format-version": sdattrs.get("format-version", ""), "start": pids.get(sdattrs.get("startnode"), START),
          "tag-colors": {html.unescape(a): html.unescape(b) for a, b in
                         re.findall(r'<tw-tag\s+name="([^"]*)"\s+color="([^"]*)"', body)},
          "zoom": float(sdattrs.get("zoom", 1)) if "." in sdattrs.get("zoom", "1") else int(sdattrs.get("zoom", 1))}
    out = [":: StoryTitle\n" + NAME + "\n", ":: StoryData\n" + json.dumps(sd, indent=2, ensure_ascii=False) + "\n"]
    for pm in re.finditer(r"<tw-passagedata\b([^>]*)>(.*?)</tw-passagedata>", body, re.S):
        attrs = dict(re.findall(r'(\w+)="([^"]*)"', pm.group(1)))
        name, tags = html.unescape(attrs["name"]), html.unescape(attrs.get("tags", "")).strip()
        meta = {k: attrs[k] for k in ("position", "size") if k in attrs}
        head = f":: {name}" + (f" [{tags}]" if tags else "") + (" " + json.dumps(meta) if meta else "")
        out.append(head + "\n" + html.unescape(pm.group(2)).strip("\n") + "\n")
    (ROOT / "passagens.twee").write_text("\n\n".join(out), encoding="utf-8")
    (ROOT / "story.js").write_text(html.unescape(js.group(1)) if js else "", encoding="utf-8")
    (ROOT / "story.css").write_text(html.unescape(css.group(1)) if css else "", encoding="utf-8")
    print(f"extraído de {src}: {len(out) - 2} passagens")

if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "extrair":
        src = sys.argv[2] if len(sys.argv) > 2 else next(iter(sorted(TWINE_LIB.glob("Tram*.html"))), None)
        assert src, f"não encontrei a história em {TWINE_LIB}; indica o ficheiro: python3 build.py extrair <ficheiro>"
        extract(src)
    else:
        build(sys.argv[1] if len(sys.argv) > 1 else ROOT.parent / "Tramitania.html")
