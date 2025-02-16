export interface Message {
  id: string;
  content: string;
  role: "user" | "assistant";
  created_at: string;
}

export interface Chat {
  id: string;
  visibility: "public" | "private";
  goal?: string;
  userId?: string;
  created_at: string;
  updated_at: string;
}

export type VisibilityType = "public" | "private"; 