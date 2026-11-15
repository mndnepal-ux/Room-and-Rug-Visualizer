"""Corrections traced from the user's red-marked November room screenshots.

Coordinates refer to the native 1024 x 683 source photographs, not screenshots.
Only inspected openings use color matting; solid furniture uses tight contours.
"""
import cv2
import numpy as np


def correct_marked_regions(room, alpha, image):
    scale = 4
    canvas = cv2.resize(alpha, None, fx=scale, fy=scale,
                        interpolation=cv2.INTER_NEAREST)

    def polygon(points, value):
        cv2.fillPoly(canvas, [np.round(np.array(points) * scale).astype(np.int32)], value)

    if room == "living":
        # The TV cabinet's brown diagonal plinth is vertical furniture,
        # not wood flooring. The floor seed followed the white doors and
        # allowed a moved rug to cover the entire lower wooden face.
        polygon([(44,491),(238,390),(238,398),(231,402),
                 (231,414),(46,523),(44,523)], 0)
        polygon([(0,493),(46,493),(46,523),(0,523)], 0)
    elif room == "lobby":
        # Counter front, including its real continuous gold plinth. The seed
        # floor boundary cut diagonally through the vertical wood slats.
        polygon([(559,285),(665,285),(665,377),(559,377)], 0)
        polygon([(665,300),(715,300),(715,350),(665,350)], 0)
        # Rounded left face of the right sofa, not exposed floor.
        polygon([(804,363),(808,361),(819,361),(827,363),(858,369),
                 (858,413),(820,399),(818,379),(811,378),
                 (805,375),(803,371)], 0)
    elif room == "loft":
        # Actual floor behind the left plant stand, up to the wall skirting.
        # The original seed boundary stopped at the cabinet's front corner.
        polygon([(40,452),(66,438),(66,487),(170,487),
                 (170,541),(40,541)], 255)
        # Preserve the full seat frame above its actual lower silhouette.
        polygon([(208,415),(297,415),(297,430),(288,435),(284,440),
                 (276,444),(261,446),(250,445),(248,442),(237,439),
                 (222,435),(212,430),(208,424)], 0)

    result = cv2.resize(canvas, (1024, 683), interpolation=cv2.INTER_AREA)
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY).astype(np.float32)
    hsv = cv2.cvtColor(image, cv2.COLOR_BGR2HSV)

    def opening(points, matte):
        area = np.zeros_like(alpha)
        cv2.fillPoly(area, [np.array(points, np.int32)], 255)
        result[area > 0] = np.clip(matte[area > 0], 0, 255).astype(np.uint8)

    if room == "lobby":
        # Small floor triangle between the left sofa foot and blue chair.
        matte = np.clip((gray - 70) / 50, 0, 1) * 255
        blue = (hsv[:, :, 0] > 80) & (hsv[:, :, 0] < 135) & (hsv[:, :, 1] > 15)
        matte[blue] = 0
        opening([(249,430),(264,421),(264,428),(270,430),
                 (271,433),(263,432),(258,431)], matte)
        # Anti-aliased gold-plinth edge ends at y=375, not in its shadow.
        plinth_matte = np.clip((110 - hsv[:, :, 1].astype(np.float32)) / 30, 0, 1) * 255
        plinth_matte[blue] = 0
        opening([(622,373),(665,373),(665,379),(622,379)], plinth_matte)
        # Narrow floor notch beside the right plant stand. Its real gold
        # posts remain opaque, while the neutral floor between them is open.
        gold_matte = np.clip((120 - hsv[:, :, 1].astype(np.float32)) / 30, 0, 1) * 255
        opening([(976,456),(999,456),(999,482),(976,482)], gold_matte)
        # Floor to the left of the coffee-table foliage was retained as a
        # rectangular plant silhouette. Keep green leaves, not their bounds.
        foliage_matte = np.clip((hsv[:, :, 1].astype(np.float32) - 45) / 30, 0, 1)
        foliage_matte[hsv[:, :, 0] < 23] = 0
        opening([(329,351),(344,351),(344,376),(329,376)],
                (1 - foliage_matte) * 255)
        # Floor inside the stand starts above the old rectangular correction.
        opening([(983,451),(987,451),(987,460),(983,460)], gold_matte)
    elif room == "dining":
        # Kitchen stand: the old thin-part region retained floor alongside
        # the long gold post, and removed some of the post above it.
        gold_matte = np.clip((90 - hsv[:, :, 1].astype(np.float32)) / 30, 0, 1) * 255
        opening([(18,599),(30,599),(36,600),(43,597),(43,639),
                 (18,639)], gold_matte)
        # White ceramic is not floor: retain the pot's curved lower edge
        # separately from the gold-post color matte.
        pot = cv2.resize(result, None, fx=scale, fy=scale,
                         interpolation=cv2.INTER_NEAREST)
        cv2.fillPoly(pot, [np.round(np.array([
            (0,545),(28,548),(28,579),(25,596),
            (22,602),(16,606),(0,606),
        ]) * scale).astype(np.int32)], 0)
        result = cv2.resize(pot, (1024, 683), interpolation=cv2.INTER_AREA)
    elif room == "loft":
        # Keep native floor beside the curved seat underside and narrow
        # swivel column. A solid seat contour must not bridge that opening.
        seat_edge_matte = np.clip((gray - 85) / 25, 0, 1) * 255
        opening([(211,430),(222,435),(239,439),(250,441),
                 (282,441),(282,449),(211,449)], seat_edge_matte)
        # Desk return bottom rail and both posts: photograph-derived matte
        # removes the stepped rug intrusion without retaining a floor strip.
        desk_matte = np.clip((gray - 100) / 35, 0, 1) * 255
        opening([(449,438),(528,438),(528,467),(449,467)], desk_matte)

        # All three cantilever frames share one connected floor opening.
        # The green upholstery boundary is separate from the tubular legs;
        # rectangular chair-base holdouts had kept large islands of floor.
        tube_matte = np.clip((gray - 55) / 40, 0, 1) * 255
        green = ((hsv[:, :, 0] > 30) & (hsv[:, :, 0] < 80) &
                 (hsv[:, :, 1] > 45))
        tube_matte[green] = 0
        opening([(646,426),(655,435),(666,441),(681,446),(685,451),
                 (688,460),(694,468),(704,476),(717,481),(731,484),
                 (783,484),(783,574),(638,574)], tube_matte)
        # Far-right chair: the old floor seed cut the descending tube and
        # bottom return halfway through. This small opening excludes the
        # table pedestal and the foreground chair's separate outer frame.
        right_frame_matte = np.clip((gray - 90) / 30, 0, 1) * 255
        opening([(916,486),(943,486),(950,515),(953,525),
                 (950,534),(916,534)], right_frame_matte)

        # Reflective gray tubes cannot be distinguished from gray floor by
        # brightness alone. Preserve only their measured thin silhouettes.
        tubes = cv2.resize(result, None, fx=scale, fy=scale,
                           interpolation=cv2.INTER_NEAREST)
        for points in [
            # The cream seat tip follows a rounded contour, not the old
            # diagonal floor opening beneath the desk.
            [(297,405),(308,405),(312,407),(315,410),(315,413),
             (312,417),(307,420),(299,424),(296,425)],
            # Actual desk support, interrupted by an earlier floor opening.
            [(445,430),(450,428),(455,430),(455,444),(445,444)],
            # Cabinet side above its sloping plinth is solid, not dark floor.
            [(170,400),(211,400),(211,420),(217,430),
             (216,434),(170,477)],
            [(692,468),(694,469),(681,526),(680,529),(678,529)],
            [(754,489),(757,489),(756,508),(753,513),
             (749,514),(749,510),(752,507)],
            [(723,508),(750,508),(750,512),(723,512)],
        ]:
            cv2.fillPoly(tubes, [np.round(np.array(points) * scale).astype(np.int32)], 0)
        result = cv2.resize(tubes, (1024, 683), interpolation=cv2.INTER_AREA)
        # Clear the tiny triangular view of floor between the curved pot
        # bottom and the right wooden post; the post begins at x=35.
        opening([(30,497),(34,493),(34,498),(30,498)],
                np.full_like(gray, 255))
        # The cabinet's left edge is x=68, not the earlier x=66 seed.
        opening([(65,440),(67,439),(67,473),(65,473)],
                np.full_like(gray, 255))
        # Small floor fringe below the left side of the curved seat frame.
        opening([(214,431),(220,433),(230,437),(239,440),
                 (239,442),(214,437)], np.full_like(gray, 255))

    return result
