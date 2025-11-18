import express from 'express'
import { CreateVm, DeleteVm, GetAllVms, GetVm, UpdateVm } from '../controllers/compute.controller.js';
const router = express.Router();

router.post('/', CreateVm);
router.get("/", GetAllVms);
router.get('/:vmId', GetVm);
router.put("/:vmId", UpdateVm);
router.delete("/:vmId", DeleteVm);

export default router;
