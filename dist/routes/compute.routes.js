import express from 'express';
const router = express.Router();
router.post('/', createVm);
router.get("/", getAllVms);
router.get('/:vmId', getVm);
router.put("/:vmId", updateVm);
router.delete("/:vmId", deleteVm);
export default router;
//# sourceMappingURL=compute.routes.js.map