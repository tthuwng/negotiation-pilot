import { NextRequest, NextResponse } from "next/server";
import { DEFAULT_CHAT_MODEL } from "../../../lib/ai/models";
import loadStytch from "../../../lib/load-stytch";
import { createClient } from "../../../lib/supabase/server";
import { generateUUID } from "../../../lib/utils";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const token = searchParams.get("token");
    const tokenType = searchParams.get("stytch_token_type");

    if (!token || !tokenType) {
      return NextResponse.redirect(new URL("/", request.url));
    }

    const stytchClient = loadStytch();

    if (tokenType === "oauth") {
      const stytchResponse = await stytchClient.oauth.authenticate({
        token: token,
        session_duration_minutes: 60 * 24,
      });

      console.log("Stytch auth response:", stytchResponse.user);

      // Create or get user in Supabase
      const supabase = await createClient();
      const { data: existingUser, error: userError } = await supabase
        .from('users')
        .select()
        .eq('id', stytchResponse.user.user_id)
        .single();

      if (userError && userError.code !== 'PGRST116') {
        console.error("Error checking user:", userError);
        return NextResponse.redirect(new URL("/", request.url));
      }

      if (!existingUser) {
        console.log("Creating new user:", stytchResponse.user.user_id);
        const { error: createUserError } = await supabase.from('users').insert({
          id: stytchResponse.user.user_id,
          email: stytchResponse.user.emails[0].email
        });

        if (createUserError) {
          console.error("Error creating user:", createUserError);
          return NextResponse.redirect(new URL("/", request.url));
        }
      }

      // Generate a new chat ID and create chat
      const chatId = generateUUID();
      console.log("Creating new chat:", chatId, "for user:", stytchResponse.user.user_id);
      
      const { data: newChat, error: chatError } = await supabase
        .from('chats')
        .insert({
          id: chatId,
          title: 'New Chat',
          "userId": stytchResponse.user.user_id,
          model: DEFAULT_CHAT_MODEL,
          visibility: 'private'
        })
        .select()
        .single();

      if (chatError) {
        console.error("Error creating chat:", chatError);
        return NextResponse.redirect(new URL("/", request.url));
      }

      console.log("Created chat:", newChat);
      const redirectURL = new URL(`/chat/${chatId}`, request.url);
      const response = NextResponse.redirect(redirectURL);
      
      // Set both session token and JWT cookies as required by Stytch
      response.cookies.set("stytch_session", stytchResponse.session_token, {
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 60 * 60 * 24, // 24 hours
        path: "/"
      });
      
      response.cookies.set("stytch_session_jwt", stytchResponse.session_jwt, {
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 60 * 60 * 24, // 24 hours
        path: "/"
      });
      
      return response;
    }

    return NextResponse.redirect(new URL("/", request.url));
  } catch (error) {
    console.error("Authentication error:", error);
    return NextResponse.redirect(new URL("/", request.url));
  }
} 