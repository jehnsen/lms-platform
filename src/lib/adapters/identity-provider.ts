/**
 * FR-1.3: single sign-on with the school identity provider (SAML 2.0 or OIDC).
 *
 * Backend seam. With a real provider the browser is redirected to the school's
 * sign-in page and the SERVER validates what comes back (the OIDC ID token or
 * the SAML assertion) before it issues a session. Nothing the browser says
 * about who signed in can be trusted, so only the mock below runs client-side.
 */
export interface IdentityAssertion {
  /** The provider's stable identifier for the person. */
  subject: string;
  email: string;
}

export interface IdentityProvider {
  readonly name: string;
  readonly protocol: "oidc" | "saml";
  /** Sends the person to the provider and resolves with who they proved to be. */
  authenticate(loginHint?: string): Promise<IdentityAssertion>;
}

/** The provider refused, or the person is not in its directory. */
export class IdentityProviderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IdentityProviderError";
  }
}

const MOCK_ROUND_TRIP_MS = 900;

/**
 * MOCK: asserts whichever email it is given, as long as the school directory
 * has it. No redirect, no password, no token.
 */
export function createMockIdentityProvider(directory: {
  hasAccount(email: string): boolean;
}): IdentityProvider {
  return {
    name: "School account (mock OIDC)",
    protocol: "oidc",
    async authenticate(loginHint = "") {
      await new Promise<void>((resolve) => setTimeout(resolve, MOCK_ROUND_TRIP_MS));
      const email = loginHint.trim().toLowerCase();
      if (!email || !directory.hasAccount(email)) {
        throw new IdentityProviderError(
          email
            ? `The school directory has no account for ${email}. Parents and guardians sign in with their email and password.`
            : "Enter your school email address first.",
        );
      }
      return { subject: `mock-idp|${email}`, email };
    },
  };
}
