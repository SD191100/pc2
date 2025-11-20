import express from 'express'
import { getTask } from '../controllers/tasks.controller.js';

const router = express.Router();

router.get('/:taskId', getTask);

export default router;
