import express from "express";
import cors from 'cors'
import computeRouter from './routes/compute.routes.js'
import rootRouter from './routes/root.routes.js'
import tasksRouter from './routes/tasks.routes.js'
import { loggingMiddleware } from "./middlewares/logging.middleware.js";

const app = express();

app.use(express.json());
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));
app.use(loggingMiddleware);

app.use('/', rootRouter);
app.use('/compute', computeRouter);
app.use('/tasks', tasksRouter);

export default app
