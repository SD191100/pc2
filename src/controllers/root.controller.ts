import type { Request, Response } from "express";


export const GetRoot = (req: Request, res: Response) => {
  const { params } = req.params
  console.log(params);
  res.status(200).json({ message: "reached to the compute api, Hello friend" })
}
