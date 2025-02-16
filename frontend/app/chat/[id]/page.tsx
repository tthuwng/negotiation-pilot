import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';

import { auth } from '@/app/(auth)/auth';
import { getChatById, getMessagesByChatId } from '@/lib/db/queries';
import { convertToUIMessages } from '@/lib/utils';
import { ChatContent } from './chat-content';

export default async function Page(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const { id } = params;
  
  const session = await auth();
  const chat = await getChatById({ id });

  if (!chat) {
    return notFound();
  }

  if (chat.visibility === 'private') {
    if (!session || !session.user) {
      return notFound();
    }

    if (session.user.id !== chat.userId) {
      return notFound();
    }
  }

  const messagesFromDb = await getMessagesByChatId({ id });
  const cookieStore = await cookies();
  const chatModelFromCookie = cookieStore.get('chat-model');
  const uiMessages = convertToUIMessages(messagesFromDb);

  return (
    <ChatContent 
      chat={chat}
      id={id}
      uiMessages={uiMessages}
      chatModel={chatModelFromCookie?.value}
      isReadonly={session?.user?.id !== chat.userId}
    />
  );
}
