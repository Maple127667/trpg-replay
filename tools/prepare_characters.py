"""立绘预处理：清残留白底 -> 稳健裁边 -> 统一成舞台尺寸的透明 PNG。

舞台是 1280x720，立绘槽位 600x700，所以统一输出 600x700、人物贴底居中，
播放器可以 1:1 使用，不用再缩放（避免二次重采样发糊）。

用法：
    python tools/prepare_characters.py            # 处理全部
    python tools/prepare_characters.py sisyphus   # 只处理一个
输入：art/char/raw/<id>.{webp,png,jpg}
输出：art/char/<id>-neutral.png
"""
from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "art" / "char" / "raw"
OUT = ROOT / "art" / "char"

WHITE_MIN = 232      # 近白阈值
WHITE_CHROMA = 10    # 允许的色差
CANVAS = (600, 700)  # 与播放器 .char 槽位一致
FIGURE_H = 660       # 人物实际高度，底部留 40px
SPARSE = 0.02        # 少于该比例的像素视为杂点，裁边时忽略


def already_cut(img: Image.Image) -> bool:
    """四角全透明，说明已经是抠好的 PNG，不要再动它。"""
    a = np.asarray(img)[:, :, 3]
    corners = (int(a[0, 0]), int(a[0, -1]), int(a[-1, 0]), int(a[-1, -1]))
    return max(corners) < 16


def clean_edge_white(img: Image.Image) -> tuple[Image.Image, int]:
    """把与画面边缘连通的不透明近白像素变透明（保留被线条包住的白色衣物）。"""
    arr = np.asarray(img.convert("RGBA")).copy()
    rgb = arr[:, :, :3].astype(int)
    alpha = arr[:, :, 3]

    near_white = (rgb.min(axis=2) >= WHITE_MIN) & ((rgb.max(axis=2) - rgb.min(axis=2)) <= WHITE_CHROMA)
    candidate = near_white & (alpha > 200)

    h, w = candidate.shape
    border = np.zeros((h, w), bool)
    border[0, :] = border[-1, :] = True
    border[:, 0] = border[:, -1] = True
    if not (candidate & border).any():
        return img, 0

    mask = Image.fromarray(np.where(candidate, 255, 0).astype(np.uint8), "L").copy()
    for y, x in np.argwhere(candidate & border):
        if mask.getpixel((int(x), int(y))) == 255:
            ImageDraw.floodfill(mask, (int(x), int(y)), 128, thresh=0)

    removed = np.asarray(mask) == 128
    arr[removed, 3] = 0
    return Image.fromarray(arr, "RGBA"), int(removed.sum())


def robust_bbox(img: Image.Image) -> tuple[int, int, int, int]:
    """忽略零星边缘杂点的可见区域包围盒。"""
    alpha = np.asarray(img)[:, :, 3] > 24
    h, w = alpha.shape
    cols = alpha.sum(axis=0)
    rows = alpha.sum(axis=1)
    xs = np.where(cols >= max(1, int(h * SPARSE)))[0]
    ys = np.where(rows >= max(1, int(w * SPARSE)))[0]
    if not len(xs) or not len(ys):
        return 0, 0, w, h
    return int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1


def normalize(img: Image.Image) -> Image.Image:
    """裁到人物实际范围，等比缩放到 FIGURE_H，贴底居中放进 CANVAS。"""
    box = robust_bbox(img)
    fig = img.crop(box)
    scale = FIGURE_H / fig.height
    size = (max(1, round(fig.width * scale)), FIGURE_H)
    fig = fig.resize(size, Image.LANCZOS)

    cw, ch = CANVAS
    if fig.width > cw:  # 太宽就回缩
        keep = cw / fig.width
        fig = fig.resize((cw, max(1, round(fig.height * keep))), Image.LANCZOS)

    canvas = Image.new("RGBA", CANVAS, (0, 0, 0, 0))
    canvas.alpha_composite(fig, ((cw - fig.width) // 2, ch - fig.height - 40))
    return canvas


def main() -> None:
    ids = sys.argv[1:] or [p.stem for p in sorted(RAW.glob("*.*")) if not p.stem.startswith(".")]
    OUT.mkdir(parents=True, exist_ok=True)
    for cid in ids:
        src = next((p for p in RAW.glob(f"{cid}.*")), None)
        if src is None:
            print(f"[skip] {cid}: 找不到原图")
            continue
        with Image.open(src) as im:
            img = im.convert("RGBA")
        if already_cut(img):
            cleaned, removed = img, 0
            note = "已是透明底"
        else:
            cleaned, removed = clean_edge_white(img)
            note = "清掉白底"
        out = normalize(cleaned)
        dest = OUT / f"{cid}-neutral.png"
        out.save(dest, "PNG", optimize=True)
        print(f"[ok] {cid:<9} {img.width}x{img.height} -> {out.width}x{out.height}"
              f"  {note} {removed:>5} px  {dest.stat().st_size/1024:6.0f} KB")


if __name__ == "__main__":
    main()
