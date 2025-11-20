import express from 'express'
import { CreateVm, DeleteVm, GetVms, GetVm, RestartVm, StartVm, StopVm, UpdateVm } from '../controllers/compute.controller.js';
const router = express.Router();

router.post('/', CreateVm);
router.get("/", GetVms);
router.get('/:vmId', GetVm);
router.patch("/:vmId", UpdateVm)
router.delete("/:vmId", DeleteVm);

router.post("/:vmId", StartVm)
router.post("/:vmId", StopVm)
router.post("/:vmId", RestartVm)


export default router;
