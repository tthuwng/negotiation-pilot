"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useStytchUser } from "@stytch/nextjs";
import Profile from "../../components/profile";
export default function ProfilePage() {
  const { user, isInitialized } = useStytchUser();
  const router = useRouter();

  console.log(isInitialized);

  useEffect(() => {
    if (isInitialized && !user) {
      router.replace("/");
    }
  }, [user, isInitialized, router]);

  return <Profile />;
}
