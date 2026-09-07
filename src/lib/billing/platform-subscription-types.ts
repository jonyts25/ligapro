export type PlatformSubscriptionActionState = {
  ok: boolean;
  message: string | null;
};

export const initialPlatformSubscriptionActionState: PlatformSubscriptionActionState =
  {
    ok: false,
    message: null,
  };
