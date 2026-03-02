import { NextResponse } from 'next/server';

/** Standardised success response — { success: true, data } */
export function apiOk<T>(data: T, status = 200) {
  return NextResponse.json({ success: true, data }, { status });
}

/** Standardised error response — { success: false, error } */
export function apiError(message: string, status = 500) {
  return NextResponse.json({ success: false, error: message }, { status });
}
