"use client";

import type { User } from "next-auth";
import { useRouter } from "next/navigation";
import axios from "axios";
import { PlusIcon } from "@/components/icons";
import { SidebarHistory } from "@/components/sidebar-history";
import { SidebarUserNav } from "@/components/sidebar-user-nav";
import { Button } from "@/components/ui/button";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  useSidebar,
} from "@/components/ui/sidebar";
import Link from "next/link";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";
import { toast } from "sonner";

export function AppSidebar({ user }: { user: User | undefined }) {
  const router = useRouter();
  const { open, setOpenMobile } = useSidebar();

  console.log(open);

  return (
    <Sidebar className="border-r">
      <SidebarHeader>
        <SidebarMenu>
          <div className="flex flex-row justify-between items-center p-5 border-b">
            <Link
              href="/chat"
              onClick={() => {
                setOpenMobile(false);
              }}
              className="flex flex-row gap-3 items-center"
            >
              <span className="text-lg font-semibold px-2 hover:bg-muted rounded-md cursor-pointer">
                Chatbot
              </span>
            </Link>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  type="button"
                  className="p-2 h-fit"
                  onClick={async () => {
                    try {
                      const response = await (
                        await axios.post("/api/chat")
                      ).data;
                      setOpenMobile(false);
                      toast.success("Chat created successfully");
                      router.push(`/chat/${response.chatId}`);
                    } catch (error) {
                      toast.error("Error creating chat");
                    }
                  }}
                >
                  <PlusIcon />
                </Button>
              </TooltipTrigger>
              <TooltipContent align="end">New Chat</TooltipContent>
            </Tooltip>
          </div>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarHistory user={user} />
      </SidebarContent>
      <SidebarFooter>{user && <SidebarUserNav user={user} />}</SidebarFooter>
    </Sidebar>
  );
}
