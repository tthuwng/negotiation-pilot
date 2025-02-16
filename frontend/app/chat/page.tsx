import { cookies } from 'next/headers';

export default async function Page() {
  const cookieStore = await cookies();
  const modelIdFromCookie = cookieStore.get('chat-model');

  return (
    <div className="flex flex-col items-center justify-center h-dvh">
      <div className="max-w-xl w-full px-4">
        <h1 className="text-2xl font-bold mb-4 text-center">Welcome to Chat</h1>
        <p className="text-center text-muted-foreground mb-8">
          Select a chat from the sidebar or start a new conversation.
        </p>
      </div>
    </div>
  );
}
