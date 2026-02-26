import { jsPDF } from 'jspdf';
import { HdmsInvoice } from './invoices';
import { HDPM_LOGO_BASE64 } from './hdpm-logo';

// ============================================
// Helpers
// ============================================

function formatCurrency(amount: number): string {
  return `$${amount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return 'N/A';
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

// ============================================
// Colors
// ============================================
const BLACK = '#111111';
const DARK = '#333333';
const MID = '#666666';
const LABEL = '#888888';
const LIGHT_BORDER = '#e0e0e0';
const BG_GRAY = '#f5f5f5';
const GREEN = '#3d7a3d';

// ============================================
// Layout constants (US Letter: 612 x 792 pt)
// ============================================
const MARGIN = 50;
const PAGE_W = 612;
const CONTENT_W = PAGE_W - MARGIN * 2; // 512

// ============================================
// Contact info
// ============================================
const PHONE = '541-548-0383';
const FAX = '541-923-0795';
const EMAIL = 'maintenance@highdesertpm.com';

// ============================================
// PDF Generator
// ============================================

/**
 * Generate an invoice PDF buffer using jsPDF.
 * Returns a Node.js Buffer suitable for uploading to Supabase Storage.
 */
export function generateInvoicePdf(invoice: HdmsInvoice): Buffer {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'pt',
    format: 'letter',
  });

  let y = MARGIN;

  // ── Header with Logo ────────────────────────
  // Logo on the left
  const logoW = 80;
  const logoH = 52; // aspect ratio ~1.54:1 from 1240x806 image
  doc.addImage(HDPM_LOGO_BASE64, 'PNG', MARGIN, y - 8, logoW, logoH);

  // Company name and subtitle to the right of logo
  const textX = MARGIN + logoW + 14;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(BLACK);
  doc.text('High Desert Maintenance Services', textX, y + 10);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(MID);
  doc.text('Internal Division of High Desert Property Management', textX, y + 24);

  // Contact info line
  doc.setFontSize(8);
  doc.setTextColor(LABEL);
  doc.text(`Phone: ${PHONE}   |   Fax: ${FAX}   |   ${EMAIL}`, textX, y + 38);

  y += logoH + 8;

  // Header divider
  doc.setDrawColor(GREEN);
  doc.setLineWidth(2);
  doc.line(MARGIN, y, MARGIN + CONTENT_W, y);
  y += 25;

  // ── Invoice Info Row ────────────────────────
  const infoBlockX = [MARGIN, MARGIN + 170, MARGIN + 340];
  let infoIdx = 0;

  // Invoice Number
  drawInfoBlock(doc, infoBlockX[infoIdx], y, 'INVOICE NUMBER', String(invoice.invoice_code));
  infoIdx++;

  // Date
  drawInfoBlock(doc, infoBlockX[infoIdx], y, 'DATE', formatDate(invoice.completed_date));
  infoIdx++;

  // Work Order (optional)
  if (invoice.wo_reference) {
    drawInfoBlock(doc, infoBlockX[infoIdx], y, 'WORK ORDER', String(invoice.wo_reference));
  }
  y += 40;

  // ── Property Section (gray background) ──────
  const propBoxH = 55;
  doc.setFillColor(BG_GRAY);
  doc.roundedRect(MARGIN, y, CONTENT_W, propBoxH, 4, 4, 'F');

  const propPad = 12;
  let propY = y + propPad + 8;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(LABEL);
  doc.text('SERVICE LOCATION', MARGIN + propPad, propY);
  propY += 14;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(BLACK);
  doc.text(String(invoice.property_name), MARGIN + propPad, propY);
  propY += 14;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor('#444444');
  doc.text(String(invoice.property_address), MARGIN + propPad, propY);

  y += propBoxH + 20;

  // ── Description ─────────────────────────────
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(LABEL);
  doc.text('DESCRIPTION OF WORK', MARGIN, y);
  y += 14;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(DARK);
  const descLines = doc.splitTextToSize(String(invoice.description), CONTENT_W);
  doc.text(descLines, MARGIN, y);
  y += descLines.length * 14 + 16;

  // ── Line Items Table ────────────────────────

  // Table header
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(LABEL);
  doc.text('ITEM', MARGIN, y);
  doc.text('AMOUNT', MARGIN + CONTENT_W, y, { align: 'right' });
  y += 8;

  doc.setDrawColor(DARK);
  doc.setLineWidth(2);
  doc.line(MARGIN, y, MARGIN + CONTENT_W, y);
  y += 14;

  // Labor row
  if (Number(invoice.labor_amount) > 0) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(DARK);
    doc.text('Labor', MARGIN, y);
    doc.text(formatCurrency(Number(invoice.labor_amount)), MARGIN + CONTENT_W, y, { align: 'right' });
    y += 8;

    doc.setDrawColor(LIGHT_BORDER);
    doc.setLineWidth(0.5);
    doc.line(MARGIN, y, MARGIN + CONTENT_W, y);
    y += 14;
  }

  // Materials row
  if (Number(invoice.materials_amount) > 0) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(DARK);
    doc.text('Materials', MARGIN, y);
    doc.text(formatCurrency(Number(invoice.materials_amount)), MARGIN + CONTENT_W, y, { align: 'right' });
    y += 8;

    doc.setDrawColor(LIGHT_BORDER);
    doc.setLineWidth(0.5);
    doc.line(MARGIN, y, MARGIN + CONTENT_W, y);
    y += 14;
  }

  // Total row
  y += 4;
  doc.setDrawColor(DARK);
  doc.setLineWidth(2);
  doc.line(MARGIN, y, MARGIN + CONTENT_W, y);
  y += 16;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(BLACK);
  doc.text('Total', MARGIN, y);

  doc.setFontSize(14);
  doc.text(formatCurrency(Number(invoice.total_amount)), MARGIN + CONTENT_W, y, { align: 'right' });

  // ── Footer ──────────────────────────────────
  const footerY = 740;
  doc.setDrawColor(GREEN);
  doc.setLineWidth(1);
  doc.line(MARGIN, footerY - 20, MARGIN + CONTENT_W, footerY - 20);

  doc.setFont('helvetica', 'italic');
  doc.setFontSize(9);
  doc.setTextColor(LABEL);
  doc.text('Thank you for your business.', PAGE_W / 2, footerY - 4, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(LABEL);
  doc.text(
    `High Desert Maintenance Services   |   Phone: ${PHONE}   |   Fax: ${FAX}   |   ${EMAIL}`,
    PAGE_W / 2,
    footerY + 10,
    { align: 'center' }
  );

  // ── Output ──────────────────────────────────
  const arrayBuffer = doc.output('arraybuffer');
  return Buffer.from(arrayBuffer);
}

// ============================================
// Internal helpers
// ============================================

function drawInfoBlock(doc: jsPDF, x: number, y: number, label: string, value: string) {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(LABEL);
  doc.text(label, x, y);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(BLACK);
  doc.text(value, x, y + 16);
}
