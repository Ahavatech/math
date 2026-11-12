// Length alone lets "password12345" through. This refuses the passwords that
// are guessed first, without making people follow arbitrary composition rules.
const COMMON = new Set([
  "password", "password1", "password12", "password123", "password1234", "passw0rd123",
  "1234567890", "12345678910", "123456789012", "0123456789", "0987654321", "1111111111",
  "0000000000", "qwertyuiop", "qwertyuiop1", "qwerty12345", "qwerty123456", "asdfghjkl1",
  "asdfghjklq", "zxcvbnm123", "iloveyou12", "iloveyou123", "welcome123", "welcome1234",
  "letmein123", "letmein1234", "admin12345", "admin123456", "administrator", "changeme123",
  "abc1234567", "abcdefghij", "abcd123456", "monkey1234", "dragon1234", "football12",
  "football123", "baseball12", "superman12", "trustno1234", "princess12", "sunshine12",
  "master1234", "shadow1234", "michael123", "jesus12345", "jesuschrist", "godisgood12",
  "godisgood123", "blessing123", "blessed1234", "nigeria1234", "nigeria2020", "nigeria2024",
  "nigeria2025", "lagos12345", "oauife1234", "oauife12345", "mathematics", "mathematics1",
  "mathematics12", "mathematics123", "obafemiawolowo", "oaumaths123", "oaumaths1234",
  "oauifemaths", "ileife12345", "ile-ife1234", "maths12345", "maths123456", "mathsdept123",
]);

export type PasswordProblem = "common" | "repetitive" | "contains-identity";

/**
 * Returns why a new password should be refused, or null if it is acceptable.
 * `identity` is what we know about the person (email, name): a password made
 * from those is guessed early.
 */
export function passwordProblem(
  password: string,
  identity: { email?: string | null; name?: string | null } = {},
): PasswordProblem | null {
  const lower = password.toLowerCase();
  const squashed = lower.replace(/[^a-z0-9]/g, "");

  if (COMMON.has(lower) || COMMON.has(squashed)) return "common";

  // "aaaaaaaaaa", "abababababab", "1234567890123"
  if (new Set(lower).size <= 2) return "repetitive";
  if (isSequence(lower)) return "repetitive";

  const parts = new Set<string>();
  const local = identity.email?.split("@")[0]?.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (local && local.length >= 4) parts.add(local);
  for (const word of (identity.name ?? "").toLowerCase().split(/\s+/)) {
    const clean = word.replace(/[^a-z]/g, "");
    if (clean.length >= 5) parts.add(clean);
  }
  for (const part of parts) {
    // The password is little more than the person's own name or email.
    if (squashed.includes(part) && squashed.length - part.length <= 4) return "contains-identity";
  }
  return null;
}

function isSequence(value: string): boolean {
  if (value.length < 8) return false;
  let step = 0;
  for (let i = 1; i < value.length; i++) {
    const diff = value.charCodeAt(i) - value.charCodeAt(i - 1);
    if (Math.abs(diff) !== 1) return false;
    if (i === 1) step = diff;
    else if (diff !== step) return false;
  }
  return true;
}

export const PASSWORD_PROBLEM_MESSAGE: Record<PasswordProblem, string> = {
  common: "That password is too easy to guess. Choose something less common, such as three or four unrelated words.",
  repetitive: "That password is a simple pattern. Choose something less predictable.",
  "contains-identity": "Do not build the password from your name or email address.",
};
