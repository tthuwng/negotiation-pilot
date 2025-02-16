import { NextRequest, NextResponse } from "next/server";
import { auth } from "../../../app/(auth)/auth";
import { createClient } from "../../../lib/supabase/server";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const supabase = await createClient();
    const { data: chats, error } = await supabase
      .from('chats')
      .select('*')
      .eq('userId', session.user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error("Error fetching chats:", error);
      return new NextResponse("Error fetching chats", { status: 500 });
    }

    return NextResponse.json(chats || []);
  } catch (error) {
    console.error("Error in history API:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
} 