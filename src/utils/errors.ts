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

export function isPgForeignKeyViolation(err: any): boolean {
  return err?.code === "23503"; // foreign_key_violation
}

// UUID validation helper
export function isValidUUID(id: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(id);
}

export function validateUUID(id: string | string[] | undefined, fieldName: string = "ID"): string {
  // Handle array case (shouldn't happen with route params, but TypeScript requires it)
  const idString = Array.isArray(id) ? id[0] : id;
  
  if (!idString) {
    throw new HttpError(400, `${fieldName} is required.`);
  }
  if (!isValidUUID(idString)) {
    throw new HttpError(400, `Invalid ${fieldName} format.`);
  }
  return idString;
}

// Date format validation helper (YYYY-MM-DD)
export function isValidDateFormat(dateString: string): boolean {
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  return dateRegex.test(dateString);
}

export function validateDateFormat(dateString: string, fieldName: string = "Date"): void {
  if (!isValidDateFormat(dateString)) {
    throw new HttpError(400, `Invalid ${fieldName} format. Expected YYYY-MM-DD.`);
  }
  
  const dateObj = new Date(dateString);
  if (isNaN(dateObj.getTime())) {
    throw new HttpError(400, `Invalid ${fieldName}.`);
  }
}
