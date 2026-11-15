"""Build photo-aligned floor alpha masks from conservative hand-traced seeds.

Only a narrow boundary band is reclassified, so image segmentation cannot turn
walls or furniture interiors into floor. Runtime rendering needs no Python.
"""
import json
import sys
from pathlib import Path

import cv2
import numpy as np
import importlib.util

detail_spec = importlib.util.spec_from_file_location(
    "floor_mask_details", Path(__file__).with_name("floor-mask-details.py"))
details = importlib.util.module_from_spec(detail_spec)
detail_spec.loader.exec_module(details)

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

    # Color segmentation cannot distinguish a gray cast shadow from a gray
    # chair leg. Correct the inspected ambiguous regions explicitly; do not
    # expand furniture masks to include shadows or reflections on bare floor.
    def polygon(points, value):
        cv2.fillPoly(refined, [np.array(points, np.int32)], value)

    if room == "loft":
        # Floor between the left chair's spokes, including its reflected legs.
        region = np.zeros_like(refined)
        cv2.fillPoly(region, [np.array([
            [204,447],[239,447],[247,443],[268,447],[310,469],
            [320,490],[198,500],[194,482],
        ], np.int32)], 255)
        refined[region > 0] = np.where(luminance[region > 0] < 95, 0, 255)
        # The opening below the back of the desk is floor, not a solid panel.
        region[:] = 0
        cv2.fillPoly(region, [np.array([
            [307,424],[322,413],[341,413],[356,420],[369,426],
            [377,436],[373,444],[301,444],
        ], np.int32)], 255)
        refined[region > 0] = np.where(luminance[region > 0] < 65, 0, 255)
    elif room == "lobby":
        # Open floor behind the central gold post. Preserve the actual rear
        # post/ring, not the beige rectangular patch produced by GrabCut.
        polygon([[362,431],[377,431],[377,442],[362,444]], 255)
        polygon([[386,431],[405,431],[405,443],[386,442]], 255)
        polygon([[379,430],[384,430],[384,444],[379,444]], 0)
    elif room == "living":
        # This is the solid bottom rail, not an opening underneath the table.
        polygon([[474,530],[635,530],[635,537],[474,537]], 0)

    refined = details.correct_openings(room, refined, image)
    # A subpixel transition removes jagged raster edges without a wide halo.
    alpha = cv2.GaussianBlur(refined, (3, 3), 0.45)
    # Guard the actual bare-floor patches exposed by the recordings, plus
    # solid furniture and thin parts that must never receive carpet.
    probes = {
        "living": {"floor": [(500,570),(710,580),(500,542),(793,530),(700,455),(740,490),(868,655),(900,655)],
                   "object": [(550,534),(386,548),(772,525),(700,441),(885,630),(884,650),(881,675)]},
        "bedroom": {"floor": [(500,650),(730,490),(866,453),(845,449),(856,451)],
                    "object": [(450,490),(856,410),(852,451),(880,452),(860,445)]},
        "lobby": {"floor": [(369,437),(391,438),(400,500),(340,460),(400,468),(940,449),(850,423),(51,505),
                            (72,550),(88,540),(160,570),(275,539),(58,506),(66,512)],
                  "object": [(381,437),(359,465),(910,446),(940,439),(154,567),(50,490),(82,540),(154,570),(270,539)]},
        "dining": {"floor": [(350,570),(720,610)], "object": [(450,590),(325,480)]},
        "loft": {"floor": [(224,477),(277,477),(320,433),(345,434),(430,485),(329,414),(217,441),(231,445),(251,445),(252,448)],
                 "object": [(256,485),(306,428),(480,446),(517,453),(120,479),(308,412),(375,414),(230,433),(256,447),(411,448)]},
    }
    # Red-marked screenshot regressions: every reported region gets both
    # an exposed-floor probe and a nearby solid-object probe.
    marked_probes = {
        "living": {
            "floor": [(100,494),(180,446),(40,527),(263,403),(281,403),(675,440)],
            "object": [(100,479),(180,432),(40,513),(256,402),(289,402),(666,435),(683,439)],
        },
        "lobby": {
            "floor": [(258,428),(263,426),(985,470),(670,382),(653,377),(812,385),(336,355),(984,455)],
            "object": [(267,425),(653,360),(660,373),(809,370),(990,470)],
        },
        "dining": {
            "floor": [(32,612)],
            "object": [(26,612),(21,599)],
        },
        "loft": {
            "floor": [(682,475),(721,500),(740,523),(470,463),(48,460),(925,520),
                      (318,418),(32,497),(66,460),(224,437)],
            "object": [(674,480),(688,490),(470,459),(34,499),(250,440),(947,520),(930,530),(924,500),(946,507),(448,435),(180,460),(739,510),
                       (312,414),(37,497),(70,460),(224,431)],
        },
    }
    for kind, points in marked_probes.get(room, {}).items():
        probes[room][kind].extend(points)
    for kind, points in probes[room].items():
        for x, y in points:
            value = int(alpha[y, x])
            assert (value > 240 if kind == "floor" else value < 20), \
                f"{room}: incorrect {kind} alpha {value} at {x},{y}"
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
