import express from 'express'
import { CreateVm, DeleteVm, GetVms, GetVm, RestartVm, StartVm, StopVm, UpdateVm } from '../controllers/compute.controller.js';
const router = express.Router();

router.post('/', CreateVm);
router.get("/", GetVms);
router.get('/:vmId', GetVm);
router.patch("/:vmId", UpdateVm)
router.delete("/:vmId", DeleteVm);

router.get("/:vmId/start", StartVm)
router.post("/:vmId/stop", StopVm)
router.post("/:vmId/restart", RestartVm)


export default router;
