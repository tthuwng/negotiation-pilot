import React from "react";
import { StytchLogin } from "@stytch/nextjs";
import { Products } from "@stytch/vanilla-js";

import { toast } from "sonner";

const Login = () => {
  return (
    <div className="sign-in-container">
      <StytchLogin
        config={{
          products: [Products.oauth, Products.otp],
          otpOptions: {
            methods: ["sms"],
            expirationMinutes: 10,
          },
          oauthOptions: {
            providers: [
              { type: "google" },
              { type: "github" },
              { type: "discord" },
              { type: "linkedin" },
            ],
          },
        }}
        callbacks={{
          onError: (error) => {
            toast.error(error.message);
          },
        }}
      />
    </div>
  );
};

export default Login;
