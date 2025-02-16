"use client";
import { useStytchUser } from "@stytch/nextjs";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import useSWR from "swr";
import LoginOrSignupForm from "../components/login-or-signup-form";
import { fetcher, generateUUID } from "../lib/utils";

export default function LoginPage() {
  const { user, isInitialized } = useStytchUser();
  const router = useRouter();
  const { data: history } = useSWR<Array<any>>(user ? '/api/history' : null, fetcher, {
    fallbackData: [],
  });

  // If the Stytch SDK detects a User then redirect to chat
  useEffect(() => {
    if (isInitialized && user) {
      if (history && history.length > 0) {
        router.replace('/chat');
      } else {
        const chatId = generateUUID();
        router.replace(`/chat/${chatId}`);
      }
    }
  }, [user, isInitialized, router, history]);

  return <LoginOrSignupForm />;
}
