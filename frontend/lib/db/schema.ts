export interface User {
  id: string;  // Stytch user ID (text format)
  email: string;
  created_at?: string;
}

export interface Chat {
  id: string;  // UUID
  title: string;
  userId: string;  // Stytch user ID (text format)
  model: string;
  visibility: 'public' | 'private';
  created_at?: string;
}

export interface Document {
  id: string;  // UUID
  chatId: string;  // UUID
  title: string;
  content?: string;
  kind: string;
  created_at?: string;
}

export interface Message {
  id: string;  // UUID
  chatId: string;  // UUID
  content: string;
  role: 'user' | 'assistant';
  created_at?: string;
}

export interface Suggestion {
  id: string;  // UUID
  documentId: string;  // UUID
  content: string;
  created_at?: string;
}

export interface Vote {
  chatId: string;  // UUID
  messageId: string;  // UUID
  isUpvoted: boolean;
  created_at?: string;
} 