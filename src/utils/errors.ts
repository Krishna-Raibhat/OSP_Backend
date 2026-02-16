export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export function isPgUniqueViolation(err: any): boolean {
  return err?.code === "23505"; // unique_violation
}
