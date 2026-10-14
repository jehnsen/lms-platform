/**
 * FR-6.6: push notifications to phones and browsers.
 *
 * Backend seam. Real push needs the user's device to be registered (a service
 * worker and a push subscription, which arrive with the installable app in
 * Phase 8) and a server that holds the push service's keys and sends to it.
 */
export interface PushMessage {
  userId: string;
  title: string;
  body: string;
  /** Where tapping the notification opens the app. */
  href?: string;
}

export interface PushProvider {
  readonly name: string;
  /** Sends to every device the user has registered. Resolves with how many it reached. */
  send(message: PushMessage): Promise<{ devices: number }>;
}

/** MOCK: nothing is sent and no device is registered. It reports one device so the delivery log has something to show. */
export const mockPushProvider: PushProvider = {
  name: "Mock push",
  async send() {
    return { devices: 1 };
  },
};
