import express from "express";
import { GetRoot } from "../controllers/root.controller.js";

const router = express.Router()

router.get('/', GetRoot)

export default router
