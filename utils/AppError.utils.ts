class AppError extends Error {
  public readonly statusCode: number;
  public readonly isoperational: boolean;

  constructor (message: string, statusCode: number) {
    super(
      message
    )

    this.statusCode = statusCode;
    this.isoperational = true;

    Error.captureStackTrace(this, this.constructor)
  }
}

export default AppError;
