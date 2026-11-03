---
name: Photo mask validation
description: Why room masks must be checked across the whole floor and not just under the default rug.
---

Review masks with a high-contrast overlay across the entire floor in every room, including the gaps beneath chairs and tables.

**Why:** A default-position rug can look correct while inaccurate furniture silhouettes leave visible bare-floor cutouts when the rug is moved. The user's recording exposed that problem. Dark floor shadows must not be classified as solid furniture, while thin metal and wood legs must remain protected.

**How to apply:** Check full-floor overlays before accepting a rebuilt mask, including thin legs, curved bases, and open spaces beneath furniture. Use the accepted alpha mask consistently for preview rendering, exported images, and floor hit testing.

Color-based segmentation alone is insufficient for shadowed floor between furniture legs. Inspect ambiguous openings against the original photo at enlarged scale and constrain them explicitly.

**Why:** A second user recording showed that plausible full-room overlays still hid floor-colored patches between office chair spokes and behind a gold table post. A sharp photo-based lighting multiply also copied floor reflections and grout onto the carpet.

**How to apply:** Inspect enlarged openings, not just furniture silhouettes. Transfer only low-frequency, floor-only lighting to the rug. Version mask URLs after replacing stored assets and clear the server asset cache.

Do not use approximate thick strokes for office chair spokes: they preserve strips of bare floor around the real metal. Inspect both kinds of error: floor cutouts and carpet painted onto furniture.

**Why:** Continued reports in Living Room, Lobby, and Office exposed remaining shadow cutouts; enlarged source inspection also revealed that the office desk return extends lower than the initial seed geometry.

**How to apply:** Constrain corrections to inspected openings, derive thin dark metal edges from actual photo pixels, and separately protect solid desk panels. Check each reported room in the live app, not only generated diagnostic overlays.

Validate the entire underside of a sofa against the photo's wooden rail, not the visible edge of its dark floor shadow.

**Why:** User close-ups clarified that the persistent “floor overlapping the rug” included a long stepped band of wood-floor shadow along the sectional, a gray strip beneath the lobby sofa, and small wedges beside chair feet. Full-room screenshots concealed these errors.

**How to apply:** Compare enlarged source and mask crops at the exact reported locations. Keep only the rail and feet opaque, and check floor immediately below diagonal rails and cabinet plinths. Avoid accepting a distant full-room view as proof that these edges are correct.

Pale regions are not necessarily floor: the Lobby sofa has a tall cream front panel behind the foreground chair, and the Office chairs expose cream seat tips beside the central floor opening.

**Why:** User close-ups highlighted these ambiguous boundaries. Treating every pale strip as a shadow/floor correction risks painting carpet over upholstery instead.

**How to apply:** Establish the physical object boundary from the original photo before clearing an ambiguous region; separately protect upholstery and fill only the narrow floor gap immediately beneath it.
