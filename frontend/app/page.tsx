"use client";
import axios from "axios";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useStytchUser } from "@stytch/nextjs";
import LoginOrSignupForm from "../components/login-or-signup-form";

export default function LoginPage() {
  const { user, isInitialized } = useStytchUser();
  const router = useRouter();
  console.log(user);
  // If the Stytch SDK detects a User then redirect to profile; for example if a logged in User navigated directly to this URL.
  useEffect(() => {
    if (isInitialized && user) {
      router.replace("/profile");
    }
  }, [user, isInitialized, router]);

  return <LoginOrSignupForm />;
}
