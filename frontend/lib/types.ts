export interface Message {
  id: string;
  content: string;
  role: "user" | "assistant";
  createdAt: string;
}

export interface Chat {
  id: string;
  visibility: "public" | "private";
  goal?: string;
  userId?: string;
  createdAt: string;
  updatedAt: string;
}

export type VisibilityType = "public" | "private"; 