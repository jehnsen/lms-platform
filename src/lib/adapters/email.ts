/**
 * FR-6.6, BR-27: the school's email system.
 *
 * Backend seam. The real adapter runs on the server with the mail service's
 * credentials (SMTP or an API), handles bounces and unsubscribes, and is
 * called by the notification service, never by the browser.
 */
export interface EmailMessage {
  to: string;
  subject: string;
  body: string;
}

export interface EmailProvider {
  readonly name: string;
  /** Hands one message to the mail system. Resolves with the mail system's id for it. */
  send(message: EmailMessage): Promise<{ id: string }>;
}

let counter = 0;

/**
 * MOCK: nothing is sent. The notification service keeps what would have gone
 * out in its delivery log, so the demo can show it.
 */
export const mockEmailProvider: EmailProvider = {
  name: "Mock email",
  async send() {
    counter += 1;
    return { id: `mock-email-${counter}` };
  },
};
