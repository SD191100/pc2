import express from "express";
import cors from 'cors'
import computeRouter from './routes/compute.routes.js'
import rootRouter from './routes/root.routes.js'
import { loggingMiddleware } from "./middlewares/logging.middleware.js";

const app = express();

app.use(express.json());
app.use(cors());
app.use(loggingMiddleware);

app.use('/', rootRouter)
app.use('/compute', computeRouter)

export default app
