import { NextRequest, NextResponse } from "next/server";
import { auth } from "../../../app/(auth)/auth";
import { createClient } from "../../../lib/supabase/server";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const { searchParams } = request.nextUrl;
    const chatId = searchParams.get("chatId");

    if (!chatId) {
      return new NextResponse("Missing chatId", { status: 400 });
    }

    const supabase = await createClient();
    const { data: votes, error } = await supabase
      .from('votes')
      .select('*')
      .eq('chatId', chatId);

    if (error) {
      console.error("Error fetching votes:", error);
      return new NextResponse("Error fetching votes", { status: 500 });
    }

    return NextResponse.json(votes || []);
  } catch (error) {
    console.error("Error in vote API:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const body = await request.json();
    const { chatId, messageId, isUpvoted } = body;

    if (!chatId || !messageId || typeof isUpvoted !== 'boolean') {
      return new NextResponse("Missing required fields", { status: 400 });
    }

    const supabase = await createClient();
    const { error } = await supabase.from('votes').upsert({
      chatId,
      messageId,
      isUpvoted
    }, {
      onConflict: 'chatId,messageId'
    });

    if (error) {
      console.error("Error upserting vote:", error);
      return new NextResponse("Error upserting vote", { status: 500 });
    }

    return new NextResponse("OK");
  } catch (error) {
    console.error("Error in vote API:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
} 