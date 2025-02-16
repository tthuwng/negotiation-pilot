import { cookies } from "next/headers";
import loadStytch from "../../lib/load-stytch";

export async function auth() {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get("stytch_session")?.value;

  if (!sessionToken) {
    return null;
  }

  try {
    const stytchClient = loadStytch();
    const { user } = await stytchClient.sessions.authenticate({ session_token: sessionToken });
    
    return {
      user: {
        id: user.user_id,
        email: user.emails[0].email,
      }
    };
  } catch (error) {
    return null;
  }
} 