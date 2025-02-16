import { createClient } from '../supabase/server';
import type { Chat } from './schema';

export async function getChatById({ id }: { id: string }): Promise<Chat | null> {
  const supabase = await createClient();
  console.log("Querying chat with ID:", id);
  
  // First try to get the chat
  const { data: chat, error } = await supabase
    .from('chats')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    // PGRST116 means no rows found, which is expected for new chats
    if (error.code !== 'PGRST116') {
      console.error('Error getting chat:', error);
    }
    console.log("No chat found with ID:", id);
    return null;
  }

  console.log("Found chat:", chat);
  return chat;
}

export async function getMessagesByChatId({ id }: { id: string }) {
  const supabase = await createClient();
  console.log("Querying messages for chat ID:", id);
  
  const { data: messages, error } = await supabase
    .from('messages')
    .select('*')
    .eq('chatId', id)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error getting messages:', error);
    return [];
  }

  console.log("Found messages:", messages);
  return messages || [];
} 