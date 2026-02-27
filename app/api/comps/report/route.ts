import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { generateRentAnalysis } from '@/lib/rent-analysis';
import { generateRentReportPdf } from '@/lib/rent-report-pdf';
import { getSupabaseAdmin } from '@/lib/supabase';
import type { SubjectProperty, CompetingListing } from '@/types/comps';

/**
 * POST /api/comps/report
 *
 * Generate a rent analysis report:
 * 1. Run analysis engine on subject property
 * 2. Generate branded PDF
 * 3. Upload to Supabase Storage
 * 4. Return signed download URL
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.email?.endsWith('@highdesertpm.com')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { subject, competing_listings } = body as {
      subject: SubjectProperty;
      competing_listings?: CompetingListing[];
    };

    // Validate required subject fields
    if (!subject?.address || !subject?.town || subject?.bedrooms === undefined) {
      return NextResponse.json(
        { error: 'Subject property must include address, town, and bedrooms' },
        { status: 400 }
      );
    }

    console.log(`[Report] Generating rent analysis for ${subject.address}, ${subject.town}...`);

    // 1. Generate analysis
    const analysis = await generateRentAnalysis(
      subject,
      session.user.email,
      competing_listings
    );

    console.log(`[Report] Analysis complete: recommended $${analysis.recommended_rent_low}-$${analysis.recommended_rent_high}/mo`);

    // 2. Generate PDF
    const pdfBuffer = generateRentReportPdf(analysis);
    console.log(`[Report] PDF generated: ${pdfBuffer.length} bytes`);

    // 3. Upload to Supabase Storage
    const supabase = getSupabaseAdmin();
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const dateStr = now.toISOString().split('T')[0];
    const sanitizedAddress = subject.address
      .replace(/[^a-zA-Z0-9]/g, '_')
      .substring(0, 40);
    const fileName = `reports/${year}/${month}/rent-analysis_${subject.town}_${sanitizedAddress}_${dateStr}.pdf`;

    const { error: uploadError } = await supabase.storage
      .from('rent-reports')
      .upload(fileName, pdfBuffer, {
        contentType: 'application/pdf',
        upsert: true,
      });

    if (uploadError) {
      console.error('[Report] Storage upload error:', uploadError);
      // If storage fails, still return the PDF as base64 so user can download
      const base64 = pdfBuffer.toString('base64');
      return NextResponse.json({
        analysis,
        pdf_base64: base64,
        download_url: null,
        storage_error: uploadError.message,
      });
    }

    // 4. Get signed URL (24-hour expiry)
    const { data: signedData, error: signedError } = await supabase.storage
      .from('rent-reports')
      .createSignedUrl(fileName, 60 * 60 * 24); // 24 hours

    if (signedError) {
      console.error('[Report] Signed URL error:', signedError);
    }

    const downloadUrl = signedData?.signedUrl || null;

    console.log(`[Report] Report uploaded. URL: ${downloadUrl ? 'yes' : 'no'}`);

    // Also return base64 for immediate download
    const base64 = pdfBuffer.toString('base64');

    return NextResponse.json({
      analysis,
      pdf_base64: base64,
      download_url: downloadUrl,
    });
  } catch (error) {
    console.error('[Report] Error:', error);
    const message = error instanceof Error ? error.message : 'Report generation failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
