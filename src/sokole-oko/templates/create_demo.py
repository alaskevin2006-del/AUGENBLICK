"""Generate original geometric source PNGs and private masks for upload acceptance."""
import json
from pathlib import Path
from PIL import Image, ImageDraw

root = Path(__file__).parent / "shapes"
root.mkdir(exist_ok=True)
(root / "course.json").write_text(json.dumps({"engine":"sokole-oko","title":"图形定位 · 点选练习","languageCode":"zh"}, ensure_ascii=False), encoding="utf8")
image = Image.new("RGB", (600, 360), "#f4edda")
draw = ImageDraw.Draw(image)
draw.ellipse((70,90,230,250), fill="#235b47")
draw.rectangle((370,90,530,250), fill="#cda852")
image.save(root / "scene.png")
for name, box, circle in [("circle", (70,90,230,250), True),("square", (370,90,530,250), False)]:
    mask = Image.new("L", image.size, 255)
    painter = ImageDraw.Draw(mask)
    (painter.ellipse if circle else painter.rectangle)(box, fill=0)
    mask.save(root / f"scene--{name}1.png")
(root / "scene.txt").write_text("ZH-S: 找到图中的两个图形。\nEN: Find both shapes.", encoding="utf8")
(root / "scene--circle1.txt").write_text("ZH-S: 请指出圆形。\nEN: Select the circle.", encoding="utf8")
print(root)
