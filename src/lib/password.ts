import { hash, verify } from "@node-rs/argon2";

export async function hashPassword(plain: string): Promise<string> {
  return hash(plain);
}

export async function verifyPassword(hashValue: string, plain: string): Promise<boolean> {
  try {
    return await verify(hashValue, plain);
  } catch {
    return false;
  }
}

/**
 * A precomputed argon2id hash of a value nobody will ever type, used to
 * run a real verify() on the "no such user" path in /login so that path
 * takes about as long as the "wrong password" path (constant-time intent,
 * not a cryptographic guarantee).
 */
export const dummyHash =
  "$argon2id$v=19$m=19456,t=2,p=1$c29tZXNhbHR2YWx1ZTE2Qg$b0ZEV0JvRHVtbXlIYXNoVmFsdWVGb3JUaW1pbmc";
