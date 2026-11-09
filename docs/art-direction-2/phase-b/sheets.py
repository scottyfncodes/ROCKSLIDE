"""Phase B before/after sheets: python3 sheets.py <before_dir> <after_dir> <out_dir>
Each sheet pairs the same shot from the two builds (before left, after right), labelled."""
import sys
from PIL import Image, ImageDraw, ImageFont

b, a, out = sys.argv[1:4]
F = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
SHEETS = {
    "compare-phone-hud": (["p-yard-hud", "p-back-hud"], 390),
    "compare-phone-cast": (["p-cast", "p-cast-night"], 390),
    "compare-phone-garage": (["p-garage", "p-garage-dusk"], 390),
    "compare-desktop": (["d-cast", "d-garage", "d-yard-hud"], 720),
}
for name, (shots, w) in SHEETS.items():
    rows = []
    for s in shots:
        pa, pb = Image.open(f"{b}/{s}.png").convert("RGB"), Image.open(f"{a}/{s}.png").convert("RGB")
        h = round(pa.height * w / pa.width)
        rows.append((s, pa.resize((w, h), Image.LANCZOS), pb.resize((w, h), Image.LANCZOS)))
    gap, lab = 12, 30
    W = gap * 3 + w * 2
    H = gap + sum(lab + r[1].height + gap for r in rows)
    sheet = Image.new("RGB", (W, H), (58, 38, 50))
    d = ImageDraw.Draw(sheet)
    font = ImageFont.truetype(F, 15)
    y = gap
    for s, ib, ia in rows:
        d.text((gap, y + 6), f"{s}  ·  BEFORE (main)", fill=(246, 236, 220), font=font)
        d.text((gap * 2 + w, y + 6), f"{s}  ·  AFTER (Phase B)", fill=(246, 236, 220), font=font)
        y += lab
        sheet.paste(ib, (gap, y)); sheet.paste(ia, (gap * 2 + w, y))
        y += ib.height + gap
    sheet.save(f"{out}/{name}.jpg", quality=84)
    print(name, sheet.size)
