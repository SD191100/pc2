class AppError extends Error {
  public readonly statusCode: number;
  public readonly errorCode: string;
  public readonly isoperational: boolean;

  constructor (message: string, statusCode: number, errorCode?: string) {
    super(
      message
    )

    this.statusCode = statusCode;
    this.errorCode = errorCode || "INTERNAL_SERVER_ERROR";
    this.isoperational = true;

    Error.captureStackTrace(this, this.constructor)
  }
}

export default AppError;
