/**
 * FR-1.4: the password policy for school-managed local accounts. The rules are
 * checked when a password is set, not when someone signs in.
 *
 * The backend must apply the same policy; this copy only drives the form.
 */
import type { PasswordPolicy } from "@/lib/types";

/** Default until the school confirms its policy (Q-08 in OPEN-QUESTIONS.md). */
export const DEFAULT_PASSWORD_POLICY: PasswordPolicy = {
  minLength: 8,
  requireUppercase: true,
  requireLowercase: true,
  requireDigit: true,
  requireSymbol: false,
};

/** The shortest and longest minimum length an admin may set. */
export const MIN_LENGTH_RANGE = { min: 6, max: 64 } as const;

export interface PasswordRule {
  id: "length" | "uppercase" | "lowercase" | "digit" | "symbol";
  label: string;
  met: boolean;
}

/** Every rule the policy turns on, with whether this password meets it. */
export function passwordRules(password: string, policy: PasswordPolicy): PasswordRule[] {
  const rules: PasswordRule[] = [
    {
      id: "length",
      label: `At least ${policy.minLength} characters`,
      met: password.length >= policy.minLength,
    },
  ];
  if (policy.requireUppercase) {
    rules.push({ id: "uppercase", label: "An uppercase letter", met: /\p{Lu}/u.test(password) });
  }
  if (policy.requireLowercase) {
    rules.push({ id: "lowercase", label: "A lowercase letter", met: /\p{Ll}/u.test(password) });
  }
  if (policy.requireDigit) {
    rules.push({ id: "digit", label: "A number", met: /\d/.test(password) });
  }
  if (policy.requireSymbol) {
    rules.push({ id: "symbol", label: "A symbol, such as ! or #", met: /[^\p{L}\p{N}\s]/u.test(password) });
  }
  return rules;
}

export function meetsPasswordPolicy(password: string, policy: PasswordPolicy) {
  return passwordRules(password, policy).every((rule) => rule.met);
}
