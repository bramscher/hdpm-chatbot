import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { renderToBuffer } from '@react-pdf/renderer';
import { getInvoiceById, updateInvoice, uploadInvoicePdf } from '@/lib/invoices';
import { createInvoicePdfElement } from '@/lib/invoice-pdf-template';

export const maxDuration = 30;

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession();
    if (!session?.user?.email?.endsWith('@highdesertpm.com')) {
      return NextResponse.json(
        { error: 'Unauthorized. Please sign in with your company Microsoft account.' },
        { status: 401 }
      );
    }

    const { id } = await params;
    const invoice = await getInvoiceById(id);

    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    if (invoice.status === 'void') {
      return NextResponse.json({ error: 'Cannot generate PDF for a voided invoice' }, { status: 400 });
    }

    // Render PDF to buffer
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pdfBuffer = await renderToBuffer(createInvoicePdfElement(invoice) as any);

    // Upload to Supabase Storage
    const pdfPath = await uploadInvoicePdf(pdfBuffer, invoice);

    // Update invoice record
    const updatedInvoice = await updateInvoice(id, {
      pdf_path: pdfPath,
      status: 'generated',
    });

    return NextResponse.json({ invoice: updatedInvoice });
  } catch (error) {
    console.error('Generate PDF error:', error);
    const message = error instanceof Error ? error.message : 'Failed to generate PDF';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
