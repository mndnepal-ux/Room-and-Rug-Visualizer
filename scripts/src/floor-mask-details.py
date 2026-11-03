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
        # The long diagonal below the sectional is cast shadow on wood floor,
        # not part of the sofa. Trace the underside of its wooden rail rather
        # than the stepped shadow boundary chosen by segmentation.
        poly([(674,426),(700,447),(728,473),(752,494),(767,508),
              (779,508),(802,508),(802,551),(665,551),(665,439)], 255)
        poly([(767,504),(780,504),(778,532),(774,535),(768,534)], 0)
        # The foreground armchair's long front leg reaches the bottom edge
        # of the photo. It was absent from the original furniture seeds.
        poly([(878,621),(898,621),(895,638),(891,661),
              (887,683),(874,683),(876,655)], 0)
    elif room == "lobby":
        # The pale vertical area behind the blue chair is the left sofa's
        # front panel, down to its plinth at y=498. It is not exposed floor.
        poly([(24,378),(47,378),(47,423),(53,463),(63,498),
              (30,499),(24,489)], 0)
        # Immediately below that plinth is floor, including the narrow shadow
        # between the plant stand and the curved side of the blue chair.
        poly([(46,499),(57,499),(60,509),(62,516),(46,516)], 255)
        # Rebuild the complete open table frame, rather than patching isolated
        # beige holes. The lower ring is a tube, never a solid ellipse/disk.
        poly([(283,425),(455,425),(455,485),(283,485)], 255)
        cv2.ellipse(mask, (371*scale, 464*scale), (79*scale, 18*scale),
                    0, 0, 360, 0, 5*scale, cv2.LINE_AA)
        line([(291,423),(291,463)], 5)
        line([(450,423),(449,463)], 5)
        line([(358,428),(358,479)], 5)
        line([(381,429),(381,446)], 4)
        # The gray strip under the right sofa is floor in shadow. Keep the
        # wooden base and individual feet, not the entire shadow rectangle.
        poly([(819,405),(845,416),(875,429),(904,441),(917,442),
              (980,442),(980,461),(817,461)], 255)
        poly([(907,438),(915,438),(915,451),(909,451)], 0)
        poly([(820,405),(826,407),(826,414),(821,412)], 0)
        # Smooth foreground chair underside. Segmentation had retained small
        # beige floor wedges around this curve and its feet.
        poly([(66,518),(76,525),(95,533),(115,540),(135,545),
              (155,548),(175,548),(195,545),(215,539),(235,531),
              (254,524),(268,518),(279,556),(279,593),(65,593)], 255)
        poly([(80,526),(93,530),(82,552),(78,560),(74,560),(74,556)], 0)
        poly([(151,547),(162,547),(157,583),(154,587),(150,586)], 0)
        poly([(259,518),(268,515),(272,535),(277,554),(273,555),(267,541)], 0)
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
        # Clear the floor shadow just below the cabinet's wooden plinth.
        poly([(68,482),(166,482),(192,457),(195,460),(174,487),
              (66,490)], 255)
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
            [304,424],[320,412],[338,411],[345,411],[352,417],
            [360,425],[364,431],[375,438],[378,443],[378,449],[304,449],
        ], np.int32)], 255)
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY).astype(np.float32)
        detail_alpha = np.clip((gray - 45) / 30, 0, 1) * 255
        result[region > 0] = detail_alpha[region > 0].astype(np.uint8)
        # Preserve the two cream seat cushions visible beside the opening.
        # Their edges must not be mistaken for the similarly colored floor.
        cv2.fillPoly(result, [np.array([
            [294,405],[306,408],[316,412],[319,414],[308,420],
            [296,426],[290,426],
        ], np.int32)], 0)
        cv2.fillPoly(result, [np.array([
            [366,406],[377,405],[382,414],[382,426],[373,422],[362,416],
        ], np.int32)], 0)
        # The right-hand desk return is a solid panel down to y=458, not
        # an opening at y=435. Preserve it after correcting the chair bases.
        cv2.fillPoly(result, [np.array([
            [456,410],[524,410],[524,460],[512,460],[511,456],
            [454,456],[451,453],[451,433],
        ], np.int32)], 0)
    return result
