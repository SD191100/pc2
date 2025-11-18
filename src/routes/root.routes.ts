import express from "express";
import { GetRoot } from "../src/controllers/root.controller.js";

const router = express.Router()

router.get('/', GetRoot)

export default router
