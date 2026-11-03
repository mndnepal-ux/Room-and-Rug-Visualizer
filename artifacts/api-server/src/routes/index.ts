import { Router, type IRouter } from "express";
import healthRouter from "./health";
import catalogRouter from "./catalog";
import roomPhotoRouter from "./room-photos";

const router: IRouter = Router();

router.use(healthRouter);
router.use(catalogRouter);
router.use(roomPhotoRouter);

export default router;
