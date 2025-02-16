"use client";
import { StytchProvider as ProviderActual } from "@stytch/nextjs";
import { createStytchUIClient } from "@stytch/nextjs/ui";

const stytchOptions = {
  cookieOptions: {
    opaqueTokenCookieName: "stytch_session",
    jwtCookieName: "stytch_session_jwt",
    path: "",
    availableToSubdomains: false,
    domain: "",
  },
};

const stytch = createStytchUIClient(
  process.env.NEXT_PUBLIC_STYTCH_PUBLIC_TOKEN || "",
  stytchOptions
);

const StytchProvider = ({ children }: { children: React.ReactNode }) => {
  return <ProviderActual stytch={stytch}>{children}</ProviderActual>;
};

export default StytchProvider;
