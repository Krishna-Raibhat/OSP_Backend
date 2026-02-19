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

// Email validation helper
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email) && email.length <= 255;
}

export function validateEmail(email: string, fieldName: string = "Email"): void {
  if (!email || typeof email !== 'string') {
    throw new HttpError(400, `${fieldName} is required.`);
  }
  if (!isValidEmail(email)) {
    throw new HttpError(400, `Invalid ${fieldName} format.`);
  }
}

// Phone validation helper (basic - adjust regex for your region)
export function isValidPhone(phone: string): boolean {
  // Allows: digits, spaces, dashes, parentheses, plus sign
  // Length: 7-20 characters (covers most international formats)
  const phoneRegex = /^[\d\s\-\(\)\+]{7,20}$/;
  return phoneRegex.test(phone);
}

export function validatePhone(phone: string, fieldName: string = "Phone"): void {
  if (!phone || typeof phone !== 'string') {
    throw new HttpError(400, `${fieldName} is required.`);
  }
  if (!isValidPhone(phone)) {
    throw new HttpError(400, `Invalid ${fieldName} format. Must be 7-20 characters with digits, spaces, dashes, or parentheses.`);
  }
}

// String length validation helper
export function validateStringLength(
  value: string, 
  fieldName: string, 
  minLength: number = 1, 
  maxLength: number = 255
): void {
  if (!value || typeof value !== 'string') {
    throw new HttpError(400, `${fieldName} is required.`);
  }
  
  const trimmed = value.trim();
  if (trimmed.length < minLength) {
    throw new HttpError(400, `${fieldName} must be at least ${minLength} characters.`);
  }
  if (trimmed.length > maxLength) {
    throw new HttpError(400, `${fieldName} must not exceed ${maxLength} characters.`);
  }
}

// Quantity validation helper
export function validateQuantity(quantity: any, fieldName: string = "Quantity"): number {
  const qty = Number(quantity);
  
  if (isNaN(qty)) {
    throw new HttpError(400, `${fieldName} must be a number.`);
  }
  if (!Number.isInteger(qty)) {
    throw new HttpError(400, `${fieldName} must be an integer.`);
  }
  if (qty < 1) {
    throw new HttpError(400, `${fieldName} must be at least 1.`);
  }
  if (qty > 1000) {
    throw new HttpError(400, `${fieldName} cannot exceed 1000.`);
  }
  
  return qty;
}
