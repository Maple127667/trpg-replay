from __future__ import annotations

import glob
import os

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

SRC_DIR = r"D:\Pictures\kp"
OUT_DIR = os.path.join(SRC_DIR, "透明PNG")

WHITE_MIN = 205          # 近白/浅灰，低饱和；只从四边向内泛洪
WHITE_CHROMA = 8
FEATHER_RADIUS = 0.55


def _neutral_bright(rgb: np.ndarray, min_value: int = WHITE_MIN, max_chroma: int = WHITE_CHROMA) -> np.ndarray:
    mn = rgb.min(axis=2)
    mx = rgb.max(axis=2)
    return (mn >= min_value) & ((mx - mn) <= max_chroma)


def _edge_run_mask(rgb: np.ndarray, depth: int = 8) -> np.ndarray:
    """Remove only very shallow neutral-gray strips sitting on an edge.

    These are compression/scan borders, not artwork.  A gray strip that runs
    deeper than six pixels, or does not open onto near-white, is left alone.
    """
    h, w, _ = rgb.shape
    depth = min(depth, h, w)
    marked = np.zeros((h, w), dtype=bool)

    specs = [
        (np.transpose(rgb[:depth, :, :], (1, 0, 2)),
         np.arange(depth)[None, :], np.arange(w)[:, None]),
        (np.transpose(rgb[-1:-depth - 1:-1, :, :], (1, 0, 2)),
         h - 1 - np.arange(depth)[None, :], np.arange(w)[:, None]),
        (rgb[:, :depth, :],
         np.arange(h)[:, None], np.arange(depth)[None, :]),
        (rgb[:, -1:-depth - 1:-1, :],
         np.arange(h)[:, None], w - 1 - np.arange(depth)[None, :]),
    ]

    for band, ys, xs in specs:
        mn = band.min(axis=2)
        mx = band.max(axis=2)
        chroma = mx - mn
        neutral = (mn >= 140) & (mn <= 240) & (chroma <= 22)
        near_white = (mn >= 232) & (chroma <= 12)

        first_non_neutral = np.argmax(~neutral, axis=1)
        all_neutral = neutral.all(axis=1)
        first_non_neutral = np.where(all_neutral, depth, first_non_neutral)
        next_idx = np.minimum(first_non_neutral, depth - 1)
        next_is_white = near_white[np.arange(band.shape[0]), next_idx]
        ok = (first_non_neutral >= 1) & (first_non_neutral <= 6) & next_is_white

        if ok.any():
            local = ok[:, None] & (np.arange(depth)[None, :] < first_non_neutral[:, None])
            marked[ys, xs] |= local

    return marked


def _border_frame_mask(rgb: np.ndarray) -> np.ndarray:
    """Mark a thin neutral-gray scan border as background.

    Some source JPEGs carry a 1 px gray line on one or more sides.  Only a
    side whose outer line is almost entirely uniform neutral gray, clearly
    darker than a near-white inner line, is treated this way.
    """
    h, w, _ = rgb.shape
    frame = np.zeros((h, w), dtype=bool)

    sides = [
        (np.s_[0, :], np.s_[1, :]),
        (np.s_[-1, :], np.s_[-2, :]),
        (np.s_[:, 0], np.s_[:, 1]),
        (np.s_[:, -1], np.s_[:, -2]),
    ]
    for outer_slice, inner_slice in sides:
        line = rgb[outer_slice].astype(np.int16)
        inner = rgb[inner_slice].astype(np.int16)
        line_mean = line.mean(axis=1)
        inner_mean = inner.mean(axis=1)
        neutral = ((line.max(axis=1) - line.min(axis=1)) <= 12) & (line_mean >= 145) & (line_mean <= 245)
        inner_bright = (inner.min(axis=1) >= 235) & ((inner.max(axis=1) - inner.min(axis=1)) <= 14)
        if neutral.mean() >= 0.95 and inner_bright.mean() >= 0.75:
            if np.median(inner_mean) - np.median(line_mean) >= 20:
                frame[outer_slice] = True
    return frame


def _background_mask(rgb: np.ndarray) -> np.ndarray:
    h, w, _ = rgb.shape
    candidate = _neutral_bright(rgb)
    candidate |= _border_frame_mask(rgb)
    candidate |= _edge_run_mask(rgb)

    mask = np.where(candidate, 255, 0).astype(np.uint8)
    mask_img = Image.fromarray(mask, "L").copy()

    border = np.zeros((h, w), dtype=bool)
    border[0, :] = border[-1, :] = True
    border[:, 0] = border[:, -1] = True

    seeds = np.argwhere(border & candidate)
    for y, x in seeds:
        if mask_img.getpixel((int(x), int(y))) == 255:
            ImageDraw.floodfill(mask_img, (int(x), int(y)), 128, thresh=0)

    return np.asarray(mask_img) == 128


def _feather(alpha: np.ndarray, background: np.ndarray) -> np.ndarray:
    """Feather inward only; never give opacity back to background pixels."""
    if FEATHER_RADIUS <= 0:
        return alpha
    img = Image.fromarray(alpha, "L").filter(ImageFilter.GaussianBlur(FEATHER_RADIUS))
    soft = np.asarray(img)
    return np.where(background, 0, soft)


def _extend_edge_colors(rgb: np.ndarray, alpha: np.ndarray, passes: int = 2) -> np.ndarray:
    """Push nearby opaque colors into the transparent rim to avoid white fringes."""
    out = rgb.copy()
    known = alpha >= 250
    h, w, _ = rgb.shape
    for _ in range(passes):
        new_known = known.copy()
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            src_y = slice(max(0, -dy), h - max(0, dy))
            dst_y = slice(max(0, dy), h - max(0, -dy))
            src_x = slice(max(0, -dx), w - max(0, dx))
            dst_x = slice(max(0, dx), w - max(0, -dx))
            src_known = known[src_y, src_x]
            dst_known = known[dst_y, dst_x]
            take = src_known & ~dst_known
            out[dst_y, dst_x][take] = out[src_y, src_x][take]
            new_known[dst_y, dst_x] |= take
        known = new_known
    return out


def process(path: str, dest: str) -> tuple[int, int, float]:
    with Image.open(path) as im:
        im = im.convert("RGB")
        icc = im.info.get("icc_profile")
        rgb = np.asarray(im).copy()

    bg = _background_mask(rgb)
    alpha = np.where(bg, 0, 255).astype(np.uint8)
    alpha = _feather(alpha, bg)
    rgb = _extend_edge_colors(rgb, alpha)

    rgba = np.dstack([rgb, alpha])
    out = Image.fromarray(rgba, "RGBA")
    save_kwargs = {"optimize": True}
    if icc:
        save_kwargs["icc_profile"] = icc
    out.save(dest, "PNG", **save_kwargs)
    return rgb.shape[1], rgb.shape[0], float(bg.mean())


def main() -> None:
    os.makedirs(OUT_DIR, exist_ok=True)
    files = sorted(glob.glob(os.path.join(SRC_DIR, "*.jpg")))
    for i, path in enumerate(files, 1):
        name = os.path.splitext(os.path.basename(path))[0] + ".png"
        dest = os.path.join(OUT_DIR, name)
        w, h, ratio = process(path, dest)
        print(f"[{i:02d}/{len(files)}] {name} {w}x{h} transparent={ratio:.1%}")


if __name__ == "__main__":
    main()
