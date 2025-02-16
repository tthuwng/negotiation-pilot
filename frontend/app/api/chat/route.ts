import { auth } from "@/app/(auth)/auth";
import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";


export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const supabase = await createClient();
    const chatId = generateUUID();

    const { error: chatError } = await supabase.from('chats').insert({
      id: chatId,
      userId: session.user.id,
      model: "chat-model-small",
      visibility: "private",
      created_at: new Date().toISOString(),
      title: 'New Chat'
    });

    if (chatError) {
      console.error("Error creating chat:", chatError);
      return new NextResponse("Error creating chat", { status: 500 });
    }

    return NextResponse.json({ chatId });
  } catch (error) {
    console.error(error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}


export async function PUT(request: NextRequest) {
  try {
    const session = await auth();

    console.log(session)

    if (!session) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const body = await request.json();
    const { messages, id: chatId } = body;

    if (!chatId || !messages || !messages.length) {
      return new NextResponse("Missing required fields", { status: 400 });
    }

    const supabase = await createClient();
    const messageId = generateUUID();
    const message = messages[0] as Message; // We expect a single message

    // Insert the user's message
    const { error: messageError } = await supabase.from('messages').insert({
      id: messageId,
      chatId: chatId,
      content: message.content,
      role: message.role,
      createdAt: new Date().toISOString()
    });

    if (messageError) {
      console.error("Error creating message:", messageError);
      return new NextResponse("Error creating message", { status: 500 });
    }

    // Generate assistant's response
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/negotiate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error("Backend request failed");
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Error in chat API route:", error);
    return NextResponse.json(
      { error: "Failed to process chat request" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await auth();
    if (!session) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const { searchParams } = request.nextUrl;
    const chatId = searchParams.get("id");

    if (!chatId) {
      return new NextResponse("Missing chat ID", { status: 400 });
    }

    const supabase = await createClient();
    const { error } = await supabase
      .from('chats')
      .delete()
      .eq('id', chatId)
      .eq('userId', session.user.id);

    if (error) {
      console.error("Error deleting chat:", error);
      return new NextResponse("Error deleting chat", { status: 500 });
    }

    return new NextResponse("OK");
  } catch (error) {
    console.error("Error in chat API:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
} 