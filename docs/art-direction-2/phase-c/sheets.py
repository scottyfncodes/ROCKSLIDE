"""Phase C before/after sheets: python3 sheets.py <before_dir> <after_dir> <out_dir>
Each row pairs the same shot from the two builds (before left, after right)."""
import sys
from PIL import Image, ImageDraw, ImageFont

b, a, out = sys.argv[1:4]
F = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
SHEETS = {
    "compare-yard": (["p-hangar", "p-equipment", "p-kennel", "p-mast"], 300),
    "compare-yard-dusk": (["p-yard-dusk"], 390),
    "compare-valley": (["p-hollin", "p-chapel", "p-house", "p-cabin"], 300),
    "compare-valley-2": (["p-topstation", "p-boathouse", "p-barrier"], 300),
    "compare-desktop": (["d-yard", "d-hollin"], 720),
}
font = ImageFont.truetype(F, 14)
for name, (shots, w) in SHEETS.items():
    rows = []
    for s in shots:
        pa, pb = Image.open(f"{b}/{s}.png").convert("RGB"), Image.open(f"{a}/{s}.png").convert("RGB")
        h = round(pa.height * w / pa.width)
        rows.append((s, pa.resize((w, h), Image.LANCZOS), pb.resize((w, h), Image.LANCZOS)))
    # phone shots: pairs side by side, two pairs to a row
    per = 2 if w <= 300 and len(rows) > 1 else 1
    gap, lab = 12, 28
    cw = (w * 2 + gap) + gap
    W = gap + per * cw
    lines = [rows[i:i + per] for i in range(0, len(rows), per)]
    H = gap + sum(lab + max(r[1].height for r in line) + gap for line in lines)
    sheet = Image.new("RGB", (W, H), (58, 38, 50))
    d = ImageDraw.Draw(sheet)
    y = gap
    for line in lines:
        x = gap
        for s, ib, ia in line:
            d.text((x, y + 6), f"{s} · BEFORE", fill=(246, 236, 220), font=font)
            d.text((x + w + gap, y + 6), f"{s} · AFTER", fill=(246, 236, 220), font=font)
            sheet.paste(ib, (x, y + lab)); sheet.paste(ia, (x + w + gap, y + lab))
            x += cw
        y += lab + max(r[1].height for r in line) + gap
    sheet.save(f"{out}/{name}.jpg", quality=84)
    print(name, sheet.size)
