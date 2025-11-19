import type { Response } from "express"

export const sendSuccess = (res: Response, statusCode: number, message: string, data?: any): void => {
  const response: any = {
    success: true,
    message,
    timestamp: new Date().toISOString()
  };
  if (data !== undefined) {
    response.data = data;
  }
  res.status(statusCode).json(response);
}

export const sendError = (res: Response, statusCode: number, message: string, error?: any, errorCode?: string): void => {
  const response: any = {
    success: false,
    message,
    timestamp: new Date().toISOString()
  };
  if (error !== undefined) {
    response.error = error;
  }
  if (errorCode !== undefined) {
    response.errorCode = errorCode;
  }
  res.status(statusCode).json(response);
}

export const sendPaginated = (res: Response, statusCode: number, message: string, items: any[], total: number, page: number, limit: number): void => {
  const start = (page - 1) * limit;
  const end = page * limit;

  const paginatedData = items.slice(start, end);
  res.status(statusCode).json({
    success: true,
    message,
    data: {
      items: paginatedData,
      total,
      page,
      limit
    },
    timestamp: new Date().toISOString()
  })
}
