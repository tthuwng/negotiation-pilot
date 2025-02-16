// middleware.ts
import { NextRequest, NextResponse } from 'next/server';
import * as stytch from 'stytch';
import { cookies } from 'next/headers';

export default async function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;


  // Bypass middleware for public routes:
  if (
    path.includes('api') ||
    path === '/login' ||
    path === '/'
  ) {
    return NextResponse.next();
  }

  // Retrieve the session JWT from the cookie
  const sessionJwt = (await cookies()).get('stytch_session_jwt')?.value;

  if (!sessionJwt) {
    // No session found, redirect to login
    return NextResponse.redirect(new URL('/', req.nextUrl));
  }

  // Instantiate the Stytch client with your credentials
  const stytchClient = new stytch.Client({
    project_id: process.env.STYTCH_PROJECT_ID || '',
    secret: process.env.STYTCH_SECRET || '',
  });

  try {
    // Try to authenticate the JWT.
    await stytchClient.sessions.authenticateJwt({ session_jwt: sessionJwt });
  } catch (error) {
    console.error('Error authenticating session:', error);
    // If authentication fails, redirect to login.
    return NextResponse.redirect(new URL('/', req.nextUrl));
  }

  // If authentication passes, allow the request to continue.
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|.*\\.png$).*)'],
};
