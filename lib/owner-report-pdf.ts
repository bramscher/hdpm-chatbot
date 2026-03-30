/**
 * Owner Report — PDF Generator
 *
 * Generates a branded multi-page PDF using jsPDF showing:
 * - Owner portfolio summary
 * - Per-property tenant history with rent timelines
 * - Roll-up totals
 */

import { jsPDF } from 'jspdf';
import { HDPM_LOGO_BASE64 } from './hdpm-logo';
import type { OwnerReport, OwnerProperty, TenantRecord } from './owner-report';

// ============================================
// Helpers
// ============================================

function fmt(amount: number): string {
  return `$${Math.round(amount).toLocaleString()}`;
}

function fmtDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
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
const WHITE = '#ffffff';

// ============================================
// Layout constants (US Letter: 612 x 792 pt)
// ============================================
const MARGIN = 50;
const PAGE_W = 612;
const PAGE_H = 792;
const CONTENT_W = PAGE_W - MARGIN * 2;
const FOOTER_Y = 750;

// ============================================
// Shared drawing functions
// ============================================

function drawHeader(doc: jsPDF): number {
  let y = MARGIN;

  const logoW = 80;
  const logoH = 52;
  doc.addImage(HDPM_LOGO_BASE64, 'PNG', MARGIN, y - 8, logoW, logoH);

  const textX = MARGIN + logoW + 14;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(BLACK);
  doc.text('High Desert Property Management', textX, y + 10);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(MID);
  doc.text('Owner Portfolio Report', textX, y + 24);

  doc.setFontSize(8);
  doc.setTextColor(LABEL);
  doc.text(
    '1515 SW Reindeer Ave, Redmond, OR 97756   |   541-548-0383   |   info@highdesertpm.com',
    textX,
    y + 38
  );

  y += logoH + 8;

  doc.setDrawColor(GREEN);
  doc.setLineWidth(2);
  doc.line(MARGIN, y, MARGIN + CONTENT_W, y);
  y += 20;

  return y;
}

function drawFooter(doc: jsPDF, pageNum: number): void {
  doc.setDrawColor(GREEN);
  doc.setLineWidth(0.5);
  doc.line(MARGIN, FOOTER_Y, MARGIN + CONTENT_W, FOOTER_Y);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(LABEL);
  doc.text(
    'Confidential — Prepared exclusively for the property owner. Not for distribution.',
    MARGIN,
    FOOTER_Y + 10
  );
  doc.text(
    'High Desert Property Management   |   highdesertpm.com',
    MARGIN,
    FOOTER_Y + 19
  );

  doc.setFontSize(7);
  doc.text(`Page ${pageNum}`, MARGIN + CONTENT_W - 40, FOOTER_Y + 19);
}

function checkPageBreak(doc: jsPDF, y: number, needed: number, pageNum: { val: number }): number {
  if (y + needed > FOOTER_Y - 20) {
    drawFooter(doc, pageNum.val);
    doc.addPage();
    pageNum.val++;
    return drawHeader(doc);
  }
  return y;
}

function drawSectionTitle(doc: jsPDF, y: number, title: string): number {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(GREEN);
  doc.text(title, MARGIN, y);
  y += 6;
  doc.setDrawColor(GREEN);
  doc.setLineWidth(0.5);
  doc.line(MARGIN, y, MARGIN + CONTENT_W, y);
  y += 14;
  return y;
}

// ============================================
// PDF Generator
// ============================================

export function generateOwnerReportPdf(report: OwnerReport): Buffer {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'pt',
    format: 'letter',
  });

  const pageNum = { val: 1 };

  // ════════════════════════════════════════════
  // PAGE 1: Summary
  // ════════════════════════════════════════════
  let y = drawHeader(doc);

  // Report title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.setTextColor(BLACK);
  doc.text('OWNER PORTFOLIO REPORT', MARGIN, y + 4);
  y += 12;

  // Owner name banner
  y += 4;
  const bannerH = 46;
  doc.setFillColor('#f0f7f0');
  doc.roundedRect(MARGIN, y, CONTENT_W, bannerH, 4, 4, 'F');
  doc.setFillColor(GREEN);
  doc.roundedRect(MARGIN, y, 4, bannerH, 2, 0, 'F');

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(MID);
  doc.text('PREPARED FOR', MARGIN + 16, y + 13);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(GREEN);
  doc.text(report.ownerName, MARGIN + 16, y + 28);

  const dateStr = new Date(report.generatedAt).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(MID);
  doc.text(dateStr, MARGIN + 16, y + 40);

  y += bannerH + 24;

  // Summary stats box
  y = drawSectionTitle(doc, y, 'PORTFOLIO SUMMARY');

  const { summary } = report;

  // Green summary box
  const summaryBoxH = 70;
  doc.setFillColor(GREEN);
  doc.roundedRect(MARGIN, y, CONTENT_W, summaryBoxH, 6, 6, 'F');

  const colW = CONTENT_W / 3;
  const statY1 = y + 20;
  const statY2 = y + 50;

  const summaryStats = [
    [
      { label: 'TOTAL PROPERTIES', value: String(summary.totalProperties) },
      { label: 'TOTAL UNITS', value: String(summary.totalUnits) },
      { label: 'MONTHLY INCOME', value: fmt(summary.totalMonthlyRent) },
    ],
    [
      { label: 'OCCUPIED', value: String(summary.occupiedUnits) },
      { label: 'VACANT', value: String(summary.vacantUnits) },
      { label: 'AVG RENT/UNIT', value: fmt(summary.avgRentPerUnit) },
    ],
  ];

  for (let row = 0; row < summaryStats.length; row++) {
    const statY = row === 0 ? statY1 : statY2;
    for (let col = 0; col < summaryStats[row].length; col++) {
      const x = MARGIN + col * colW + 16;
      const stat = summaryStats[row][col];

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor('#ffffffcc');
      doc.text(stat.label, x, statY - 6);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.setTextColor(WHITE);
      doc.text(stat.value, x, statY + 6);
    }
  }

  y += summaryBoxH + 8;

  if (summary.longestTenancy) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(MID);
    doc.text(
      `Longest tenancy: ${summary.longestTenancy.tenantName} (${summary.longestTenancy.years} years)`,
      MARGIN,
      y + 6
    );
    y += 16;
  }

  y += 16;

  // Property list overview
  y = checkPageBreak(doc, y, 60, pageNum);
  y = drawSectionTitle(doc, y, 'PROPERTIES');

  for (const prop of report.properties) {
    y = checkPageBreak(doc, y, 40, pageNum);

    // Property row
    doc.setFillColor(BG_GRAY);
    doc.roundedRect(MARGIN, y - 4, CONTENT_W, 20, 2, 2, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(BLACK);
    doc.text(prop.address || prop.name, MARGIN + 8, y + 8);

    const totalRent = prop.units.reduce((sum, u) => sum + (u.currentRent || 0), 0);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(MID);
    doc.text(
      `${prop.city}, ${prop.state}   •   ${prop.units.length} unit(s)   •   ${fmt(totalRent)}/mo`,
      MARGIN + 8,
      y + 18
    );

    y += 28;
  }

  drawFooter(doc, pageNum.val);

  // ════════════════════════════════════════════
  // PROPERTY DETAIL PAGES
  // ════════════════════════════════════════════

  for (const prop of report.properties) {
    doc.addPage();
    pageNum.val++;
    y = drawHeader(doc);

    // Property header
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(BLACK);
    doc.text(prop.address || prop.name, MARGIN, y + 4);
    y += 10;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(MID);
    const propDetails = [
      prop.city && `${prop.city}, ${prop.state} ${prop.zip}`,
      prop.propertyType,
    ]
      .filter(Boolean)
      .join('   •   ');
    doc.text(propDetails, MARGIN, y + 4);
    y += 20;

    // Per-unit tenant history
    for (const unit of prop.units) {
      y = checkPageBreak(doc, y, 80, pageNum);

      // Unit header (if multi-unit)
      if (prop.units.length > 1 && unit.unitName) {
        doc.setFillColor('#e8f0e8');
        doc.roundedRect(MARGIN, y - 2, CONTENT_W, 16, 2, 2, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.setTextColor(GREEN);
        doc.text(`Unit: ${unit.unitName}`, MARGIN + 8, y + 9);

        const unitInfo = [
          unit.bedrooms && `${unit.bedrooms} BR`,
          unit.bathrooms && `${unit.bathrooms} BA`,
          unit.sqft && `${unit.sqft.toLocaleString()} sqft`,
          unit.currentRent && `Current: ${fmt(unit.currentRent)}/mo`,
        ]
          .filter(Boolean)
          .join('   •   ');

        if (unitInfo) {
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(8);
          doc.setTextColor(MID);
          doc.text(unitInfo, MARGIN + 180, y + 9);
        }

        y += 22;
      }

      // Tenant history table header
      y = checkPageBreak(doc, y, 40, pageNum);

      const cols = [
        { label: 'TENANT', x: MARGIN, w: 120 },
        { label: 'MOVE-IN', x: MARGIN + 125, w: 70 },
        { label: 'MOVE-OUT', x: MARGIN + 200, w: 70 },
        { label: 'RENT', x: MARGIN + 275, w: 60 },
        { label: 'LEASE START', x: MARGIN + 340, w: 70 },
        { label: 'LEASE END', x: MARGIN + 415, w: 70 },
        { label: 'STATUS', x: MARGIN + 435, w: 60 },
      ];

      doc.setFillColor(GREEN);
      doc.rect(MARGIN, y - 3, CONTENT_W, 14, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(WHITE);
      for (const col of cols) {
        doc.text(col.label, col.x + 3, y + 7);
      }
      y += 16;

      if (unit.tenantHistory.length === 0) {
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(8);
        doc.setTextColor(LABEL);
        doc.text('No tenant records found', MARGIN + 3, y + 4);
        y += 18;
      } else {
        for (let i = 0; i < unit.tenantHistory.length; i++) {
          y = checkPageBreak(doc, y, 16, pageNum);
          const t = unit.tenantHistory[i];

          if (i % 2 === 0) {
            doc.setFillColor(BG_GRAY);
            doc.rect(MARGIN, y - 8, CONTENT_W, 14, 'F');
          }

          doc.setFont('helvetica', 'normal');
          doc.setFontSize(8);
          doc.setTextColor(DARK);
          doc.text(t.tenantName.substring(0, 22), cols[0].x + 3, y);
          doc.text(fmtDate(t.moveInDate), cols[1].x + 3, y);
          doc.text(fmtDate(t.moveOutDate), cols[2].x + 3, y);

          // Rent in bold
          if (t.rent) {
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(BLACK);
            doc.text(fmt(t.rent), cols[3].x + 3, y);
          } else {
            doc.text('—', cols[3].x + 3, y);
          }

          doc.setFont('helvetica', 'normal');
          doc.setTextColor(DARK);
          doc.text(fmtDate(t.leaseStartDate), cols[4].x + 3, y);
          doc.text(fmtDate(t.leaseEndDate), cols[5].x + 3, y);

          // Status with color
          if (t.isCurrent) {
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(GREEN);
          } else {
            doc.setTextColor(LABEL);
          }
          doc.text(t.status, cols[6].x + 3, y);

          y += 14;
        }
      }

      y += 10;
    }

    // Per-property rent summary
    const currentTenants = prop.units.flatMap(u =>
      u.tenantHistory.filter(t => t.isCurrent)
    );
    const totalCurrentRent = currentTenants.reduce((sum, t) => sum + (t.rent || 0), 0);

    if (totalCurrentRent > 0) {
      y = checkPageBreak(doc, y, 30, pageNum);

      doc.setFillColor('#f0f7f0');
      doc.roundedRect(MARGIN, y, CONTENT_W, 22, 4, 4, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(GREEN);
      doc.text(
        `Property Total: ${fmt(totalCurrentRent)}/mo   •   ${currentTenants.length} current tenant(s)`,
        MARGIN + 12,
        y + 14
      );
      y += 30;
    }

    drawFooter(doc, pageNum.val);
  }

  const arrayBuffer = doc.output('arraybuffer');
  return Buffer.from(arrayBuffer);
}
