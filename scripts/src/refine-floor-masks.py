"""Build photo-aligned floor alpha masks from conservative hand-traced seeds.

Only a narrow boundary band is reclassified, so image segmentation cannot turn
walls or furniture interiors into floor. Runtime rendering needs no Python.
"""
import json
import sys
from pathlib import Path

import cv2
import numpy as np

seed_file, image_dir, output_dir = map(Path, sys.argv[1:4])
output_dir.mkdir(parents=True, exist_ok=True)
files = {
    "living": "Living_Room_1793697570495.jpeg",
    "bedroom": "Bedroom_1793697570495.png",
    "lobby": "Lobby_1793697563423.jpeg",
    "dining": "Kitchen_1793697570496.jpeg",
    "loft": "Office_1793697570496.jpeg",
}
seeds = json.loads(seed_file.read_text())
for room, filename in files.items():
    image = cv2.resize(cv2.imread(str(image_dir / filename)), (1024, 683))
    geometry = seeds[room]
    floor = np.zeros((683, 1024), np.uint8)
    cv2.fillPoly(floor, [np.array(geometry["outline"], np.int32)], 255)
    furniture = np.zeros_like(floor)
    fine_parts = []
    for polygon in geometry["furniture"]:
        part = np.zeros_like(floor)
        cv2.fillPoly(part, [np.array(polygon, np.int32)], 255)
        furniture = cv2.bitwise_or(furniture, part)
        # Thin legs and table rings must not be swallowed by the floor model.
        if cv2.distanceTransform(part, cv2.DIST_L2, 5).max() <= 9:
            region = cv2.dilate(part, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (11, 11)))
            fine_parts.append((part, region))
    floor[furniture > 0] = 0

    # Existing geometry only initializes the labels. The final silhouette is
    # determined by photograph colors and edges, within a bounded search band.
    radius = 12
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (radius * 2 + 1, radius * 2 + 1))
    sure_floor = cv2.erode(floor, kernel)
    possible_floor = cv2.dilate(floor, kernel)
    labels = np.where(floor > 0, cv2.GC_PR_FGD, cv2.GC_PR_BGD).astype(np.uint8)
    labels[possible_floor == 0] = cv2.GC_BGD
    labels[sure_floor > 0] = cv2.GC_FGD
    luminance = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    fine_objects = np.zeros(floor.shape, dtype=bool)
    for part, region in fine_parts:
        sample = luminance[(region > 0) & (floor > 0)]
        object_sample = luminance[part > 0]
        # Each metal/wood leg has its own color. A global dark-pixel threshold
        # would also preserve cast floor shadows as visible beige cutouts.
        floor_level = float(np.median(sample)) if sample.size else 195
        object_level = float(np.percentile(object_sample, 20)) + 15
        threshold = min(165, floor_level - 30, object_level)
        fine_objects |= (region > 0) & (luminance < threshold)
    labels[fine_objects] = cv2.GC_BGD
    bg_model = np.zeros((1, 65), np.float64)
    fg_model = np.zeros((1, 65), np.float64)
    cv2.setRNGSeed(42)
    cv2.grabCut(image, labels, None, bg_model, fg_model, 5, cv2.GC_INIT_WITH_MASK)
    refined = np.where((labels == cv2.GC_FGD) | (labels == cv2.GC_PR_FGD), 255, 0).astype(np.uint8)
    refined[fine_objects] = 0

    # A subpixel transition removes jagged raster edges without a wide halo.
    alpha = cv2.GaussianBlur(refined, (3, 3), 0.45)
    rgba = np.full((683, 1024, 4), 255, np.uint8)
    rgba[:, :, 3] = alpha
    cv2.imwrite(str(output_dir / f"{room}-mask.png"), rgba)
    # A full-floor diagnostic exposes mask errors even for very large rugs.
    checker = np.indices(floor.shape).sum(axis=0) // 20 % 2
    tint = np.zeros_like(image)
    tint[:] = (150, 55, 190)
    tint[checker == 0] = (190, 95, 225)
    a = (alpha.astype(np.float32) / 255 * .72)[:, :, None]
    diagnostic = (image * (1 - a) + tint * a).astype(np.uint8)
    cv2.imwrite(str(output_dir / f"{room}-diagnostic.jpg"), diagnostic)
    print(f"{room}: {np.count_nonzero(refined)} floor pixels, {(refined != floor).sum()} boundary pixels refined")
