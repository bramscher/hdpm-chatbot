import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

/**
 * GET /r/[id]
 *
 * Short-link redirect for rent analysis reports.
 * Looks up the report file path in the report_links table,
 * generates a fresh signed URL, and redirects the user.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (!id || id.length < 6) {
    return NextResponse.json({ error: 'Invalid link' }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();

  // Look up the file path for this short ID
  const { data, error } = await supabase
    .from('report_links')
    .select('file_path, expires_at')
    .eq('short_id', id)
    .single();

  if (error || !data) {
    return new NextResponse(
      '<html><body style="font-family:system-ui;display:flex;align-items:center;justify-content:center;height:100vh;margin:0"><div style="text-align:center"><h1 style="color:#333">Report Not Found</h1><p style="color:#666">This link may have expired or is invalid.</p><p style="color:#999;font-size:14px">Contact High Desert Property Management for a new link.</p></div></body></html>',
      { status: 404, headers: { 'Content-Type': 'text/html' } }
    );
  }

  // Check expiry
  if (data.expires_at && new Date(data.expires_at) < new Date()) {
    return new NextResponse(
      '<html><body style="font-family:system-ui;display:flex;align-items:center;justify-content:center;height:100vh;margin:0"><div style="text-align:center"><h1 style="color:#333">Link Expired</h1><p style="color:#666">This report link has expired.</p><p style="color:#999;font-size:14px">Contact High Desert Property Management for a new link.</p></div></body></html>',
      { status: 410, headers: { 'Content-Type': 'text/html' } }
    );
  }

  // Generate a fresh signed URL (1 hour)
  const { data: signedData, error: signedError } = await supabase.storage
    .from('rent-reports')
    .createSignedUrl(data.file_path, 60 * 60);

  if (signedError || !signedData?.signedUrl) {
    return new NextResponse(
      '<html><body style="font-family:system-ui;display:flex;align-items:center;justify-content:center;height:100vh;margin:0"><div style="text-align:center"><h1 style="color:#333">Error</h1><p style="color:#666">Unable to load this report. Please try again.</p></div></body></html>',
      { status: 500, headers: { 'Content-Type': 'text/html' } }
    );
  }

  return NextResponse.redirect(signedData.signedUrl);
}
