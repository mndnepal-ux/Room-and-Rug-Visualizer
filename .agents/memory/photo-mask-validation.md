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
