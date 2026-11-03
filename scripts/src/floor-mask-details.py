"""Photo-specific occlusion details; shadows are deliberately not objects."""
import cv2
import numpy as np


def correct_openings(room, alpha, image):
    # Supersampling gives thin metal/wood contours their own antialiased edges,
    # instead of expanding a color-segmentation mask into the surrounding floor.
    scale = 4
    mask = cv2.resize(alpha, None, fx=scale, fy=scale, interpolation=cv2.INTER_NEAREST)

    def poly(points, value):
        cv2.fillPoly(mask, [np.round(np.array(points) * scale).astype(np.int32)], value)

    def line(points, width):
        cv2.polylines(mask, [np.round(np.array(points) * scale).astype(np.int32)],
                      False, 0, round(width * scale), cv2.LINE_AA)

    if room == "living":
        # Open floor below coffee table, not the table's cast shadow.
        poly([(373,538),(649,538),(649,568),(373,568)], 255)
        poly([(383,538),(397,538),(394,556),(383,556)], 0)
        poly([(624,538),(635,538),(640,556),(628,556)], 0)
        # Floor to the right of the sectional foot, beneath its overhang.
        poly([(780,516),(802,515),(802,538),(779,538)], 255)
    elif room == "lobby":
        # Rebuild the complete open table frame, rather than patching isolated
        # beige holes. The lower ring is a tube, never a solid ellipse/disk.
        poly([(283,425),(455,425),(455,485),(283,485)], 255)
        cv2.ellipse(mask, (371*scale, 464*scale), (79*scale, 18*scale),
                    0, 0, 360, 0, 5*scale, cv2.LINE_AA)
        line([(291,423),(291,463)], 5)
        line([(450,423),(449,463)], 5)
        line([(358,428),(358,479)], 5)
        line([(381,429),(381,446)], 4)
    elif room == "loft":
        # Entire floor between both swivel chair bases. Explicit contours
        # preserve the real spokes and wheels without preserving reflections.
        poly([(190,446),(228,441),(282,441),(293,445),(378,445),
              (404,441),(449,441),(474,437),(505,437),(505,501),
              (190,501)], 255)
        # Below the rear chair: floor remains visible between its rear wheels.
        poly([(306,437),(321,417),(339,413),(345,415),(351,420),
              (368,438),(378,443),(378,449),(305,449)], 255)
        # Bare floor left of the chair column, formerly a rectangular cutout.
        poly([(194,449),(211,437),(225,443),(241,447),(241,452),
              (217,454),(197,461)], 255)
    result = cv2.resize(mask, (1024, 683), interpolation=cv2.INTER_AREA)
    if room == "loft":
        # Actual black metal has a clear luminance boundary here. Work only
        # inside these inspected openings: broad GrabCut furniture regions
        # and approximate stroked spokes both produce floor-colored halos.
        region = np.zeros_like(alpha)
        cv2.fillPoly(region, [np.array([
            [190,446],[228,441],[282,441],[293,445],[378,445],
            [404,441],[449,441],[474,437],[505,437],[505,501],[190,501],
        ], np.int32)], 255)
        cv2.fillPoly(region, [np.array([
            [306,437],[321,417],[339,413],[345,415],[351,420],
            [368,438],[378,443],[378,449],[305,449],
        ], np.int32)], 255)
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY).astype(np.float32)
        detail_alpha = np.clip((gray - 45) / 30, 0, 1) * 255
        result[region > 0] = detail_alpha[region > 0].astype(np.uint8)
        # The right-hand desk return is a solid panel down to y=458, not
        # an opening at y=435. Preserve it after correcting the chair bases.
        cv2.fillPoly(result, [np.array([
            [456,410],[524,410],[524,460],[512,460],[511,456],
            [454,456],[451,453],[451,433],
        ], np.int32)], 0)
    return result
