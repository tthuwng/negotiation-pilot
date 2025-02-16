import { auth } from "@/app/(auth)/auth";
import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    
    // Forward request to backend chat endpoint
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/chat`, {
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