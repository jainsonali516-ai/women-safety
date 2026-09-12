import { z } from "zod";

// Genuine 10-digit Indian mobile numbers only: starts 6-9, optional +91/91/0 prefix, normalized to +91XXXXXXXXXX.
const INDIAN_MOBILE_RE = /^(?:\+91|91|0)?([6-9]\d{9})$/;

export const indianPhoneSchema = z
  .string()
  .trim()
  .regex(INDIAN_MOBILE_RE, "Enter a valid 10-digit Indian mobile number")
  .transform((val) => {
    const match = val.match(INDIAN_MOBILE_RE)!;
    return `+91${match[1]}`;
  });

export const otpSchema = z
  .string()
  .trim()
  .regex(/^\d{4,8}$/, "Invalid OTP code");

export const emailSchema = z.string().trim().toLowerCase().email("Enter a valid email address").max(254);

export const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(72, "Password must be at most 72 characters"); // bcrypt silently truncates beyond 72 bytes

export const coordinateSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});

export const nameSchema = z
  .string()
  .trim()
  .min(1)
  .max(80)
  .regex(/^[\p{L}\p{N}\s.'-]+$/u, "Name contains invalid characters");

export const freeTextSchema = (max = 500) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((val) => val.replace(/[<>]/g, ""));

export function safeParse<T>(schema: z.ZodType<T>, value: unknown) {
  const result = schema.safeParse(value);
  if (!result.success) {
    return { ok: false as const, error: result.error.issues[0]?.message ?? "Invalid input" };
  }
  return { ok: true as const, data: result.data };
}
