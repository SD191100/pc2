import express, { type Request, type Response } from "express";
import computeRouter from './routes/compute.routes.js'
import rootRouter from './routes/root.routes.js'

const app = express();
const PORT = 3000;

app.use(express.json());

app.use('/', rootRouter)
app.use('/compute', computeRouter)


export default app
