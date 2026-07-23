import { NextResponse } from 'next/server'

export async function middleware(request) {
  // Allow unauthenticated guest access to /chat so "Try without account" works with local storage
  return NextResponse.next()
}

export const config = {
  matcher: [],
}
