import express, { type Request, type Response } from "express";
import { createVm, destroyVm, getVm, getVmState, listVms, type CreateVMRequest } from "./pulumi/pulumi.js";
import computeRouter from './routes/compute.routes.js'

const app = express();
const PORT = 3000;

app.use(express.json());

app.use('/compute', computeRouter)

app.get("/", (req: Request, res: Response) => {
  res.json({ message: "Hello World!" });
});

app.post("/compute", (req: Request, res: Response) => {
  //   console.log(req.body);
  const { name, id, cpu, memory, storage, username, password, sshKey, templateId, gateway, ioAddress }: CreateVMRequest = req.body;

  if (
    id == null ||
    name == null ||
    cpu == null ||
    memory == null ||
    sshKey == null ||
    templateId == null ||
    storage == null ||
    password == null ||
    ioAddress == null ||
    gateway == null ||
    username == null
  ) {
    console.error("Missing required fields");
    res.status(400).json({ message: "Missing required fields" });
    return;
  }

  const vm = {
    id: id,
    name: name,
    cpu: cpu,
    memory: memory,
    storage: storage,
    username: username,
    password: password,
    sshKey: sshKey,
    templateId: templateId,
    ioAddress: ioAddress,
    gateway: gateway
  };

  createVm(vm);

  res.json({
    message: "VM created!",
    name: vm.name,
    cpu: vm.cpu,
    memory: vm.memory,
    storage: vm.storage,
    username: vm.username,
  });
});

app.get(`/compute/vms/:vmId`, (req: Request, res: Response) => {
  const { vmId } = req.params;

  if (vmId == null) {
    console.error("Missing vm id");
    res.status(400).json({ message: "Missing vm id" });
    return;
  }

  try {
    const output = getVmState(vmId);
    res.status(202).json({ message: "vm fetched successfully", output: output });
  } catch (error) {
    console.error("Missing vm id");
    res.status(400).json({ message: "Missing vm id" });
    return;

  }
})

app.get(`/compute/vms`, async (req: Request, res: Response) => {
  
  try {
    const output = await listVms();
    console.log("hello", output)
    res.status(202).json({ message: "vm fetched successfully", output: output });
  } catch (error) {
    console.error("Missing vm id");
    res.status(400).json({ message: "Missing vm id" });
    return;
  }
})


app.delete(`/compute/vms/:vmId`, (req: Request, res: Response) => {
  const { vmId } = req.params;

  if (vmId == null) {
    res.status(400).json({ message: "VmId not provided, aborting deletion" })
    return
  }

  try {
    destroyVm(vmId);
    res.status(202).json({
      message: `VM destruction for 'vm-${vmId}' has been started.`
    });
  } catch (e) {
    console.error(`[error] ${e}`);
    res.status(500).json({
      message: `stack not found ${e}`
    })
  }

})

app.listen(PORT, () => {
  console.log(`server running on port ${PORT}`);
});
