class AppError extends Error {
  public readonly statusCode: number;
  public readonly errorCode: string;
  public readonly isoperational: boolean;
  public readonly details?: any;

  constructor (message: string, statusCode: number, errorCode?: string, details?: any) {
    super(
      message
    )

    this.statusCode = statusCode;
    this.errorCode = errorCode || "INTERNAL_SERVER_ERROR";
    this.isoperational = true;
    this.details = details;

    Error.captureStackTrace(this, this.constructor)
  }
}

export default AppError;
