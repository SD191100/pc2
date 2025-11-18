import type { NextFunction, Request, Response } from "express";
import type { CreateVMRequest } from "../types/compute.type.js";
import { CreateOrUpdateVm, DestroyVm, GetVmState, ListVms } from "../services/compute.service.js";
import logger from "../utils/Logger.utils.js";
import AppError from "../utils/AppError.utils.js";


export const CreateVm = async (req: Request, res: Response, next: NextFunction) => {
  console.log("hit createVm");
  try {
    const vmConfig: CreateVMRequest = req.body;

    if (!vmConfig || !vmConfig.name || !vmConfig.cpu || !vmConfig.memory || !vmConfig.storage || !vmConfig.id || !vmConfig.ioAddress || !vmConfig.gateway) {
      logger.info(`Missing required VM configuration`)
      res.status(400).json({ message: "Missing required VM configuration." })
      return next(new AppError('Missing required VM config', 400));
    }

    if (!vmConfig.username || !vmConfig.password) {
      vmConfig.username = "administrator";
      vmConfig.password = "administrator";
    }

    if (!vmConfig.sshKey) {
      logger.info(`Creating ssh key for connecting to port 22`)
      // const { privateKey, publicKey } = await generateSshKey();
      //   vmConfig.sshKey = publicKey;
      //   privatekey = privateKey;
      // }

      console.log();
      logger.info(`Recieved request to create VM: ${vmConfig.name}`);

      await CreateOrUpdateVm(vmConfig);

      res.status(200).json({
        message: `VM Creation for '${vmConfig.name}' has been started.`,
      });
    }
  } catch (error: any) {
    logger.error(``)
    logger.error(`Failed to create vm ${error}`);
    res.status(500).json({ message: `[error] ${error}` });
    throw new AppError(`Pulumi operation failed to create vm: ${error} `, 500);
  }
}


export const DeleteVm = async (req: Request, res: Response) => {
  try {
    const { vmId } = req.params;

    if (!vmId) {
      logger.error(`VM id is required.`)
      return res.status(400).json({ message: "VM id is required." });
    }

    logger.info(`Recieved request to destroy VM: vm-${vmId}.`);

    await DestroyVm(vmId);

    res.status(202).json({
      message: `VM destruction for 'vm-${vmId}' has been started.`,
    });
  } catch (error) {
    console.error(`[error] ${error}`)
    res.status(500).json({ message: `[error] ${error}` });
  }
}

export const GetAllVms = async (req: Request, res: Response) => {
  try {
    const vms = await ListVms();
    res.status(200).json({ message: "list fetched successfully", output: vms });
  } catch (error: any) {
    logger.error(`[error] ${error}`)
    res.status(500).json({ message: `[error] ${"stack not found."}` });
  }
}

export const GetVm = async (req: Request, res: Response) => {
  try {
    const { vmId } = req.params;
    if (!vmId) {
      return res.status(400).json({ message: "VM id is required." });
    }
    const state = await GetVmState(vmId);
    res.status(200).json({ message: "list fetched successfully", output: state });
  } catch (error: any) {
    console.error(`[error] ${error.message}`);
    // Send the actual error message in the response
    res.status(500).json({ message: `[error] ${error.message}` });
  }
}

export const UpdateVm = CreateVm;


