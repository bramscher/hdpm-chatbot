/**
 * Owner Report — Excel Generator
 *
 * Creates a multi-sheet Excel workbook:
 *   Sheet 1: Portfolio Summary (roll-up stats)
 *   Sheet 2: Property Details (one row per unit)
 *   Sheet 3: Tenant History (one row per tenant record with rent timeline)
 */

import * as XLSX from 'xlsx';
import type { OwnerReport } from './owner-report';

function fmtDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '';
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function generateOwnerReportExcel(report: OwnerReport): Buffer {
  const wb = XLSX.utils.book_new();

  // ════════════════════════════════════════════
  // Sheet 1: Portfolio Summary
  // ════════════════════════════════════════════
  const summaryData = [
    ['Owner Portfolio Report'],
    ['Prepared for:', report.ownerName],
    ['Generated:', new Date(report.generatedAt).toLocaleDateString('en-US', {
      year: 'numeric', month: 'long', day: 'numeric',
    })],
    [],
    ['Portfolio Summary'],
    ['Total Properties', report.summary.totalProperties],
    ['Total Units', report.summary.totalUnits],
    ['Occupied Units', report.summary.occupiedUnits],
    ['Vacant Units', report.summary.vacantUnits],
    ['Total Monthly Rent', report.summary.totalMonthlyRent],
    ['Avg Rent per Unit', report.summary.avgRentPerUnit],
  ];

  if (report.summary.longestTenancy) {
    summaryData.push([
      'Longest Tenancy',
      `${report.summary.longestTenancy.tenantName} (${report.summary.longestTenancy.years} years)`,
    ]);
  }

  summaryData.push([], ['Properties Overview']);
  summaryData.push([
    'Property', 'Address', 'City', 'State', 'Zip', 'Type', 'Units', 'Monthly Rent',
  ]);

  for (const prop of report.properties) {
    const totalRent = prop.units.reduce((sum, u) => sum + (u.currentRent || 0), 0);
    summaryData.push([
      prop.name,
      prop.address,
      prop.city,
      prop.state,
      prop.zip,
      prop.propertyType,
      prop.units.length,
      totalRent,
    ]);
  }

  const summarySheet = XLSX.utils.aoa_to_sheet(summaryData as unknown[][]);

  // Column widths
  summarySheet['!cols'] = [
    { wch: 20 }, { wch: 35 }, { wch: 15 }, { wch: 8 },
    { wch: 10 }, { wch: 15 }, { wch: 8 }, { wch: 15 },
  ];

  XLSX.utils.book_append_sheet(wb, summarySheet, 'Summary');

  // ════════════════════════════════════════════
  // Sheet 2: Property Details
  // ════════════════════════════════════════════
  const detailRows: unknown[][] = [
    [
      'Property Name', 'Property Address', 'City', 'State', 'Zip',
      'Property Type', 'Unit', 'Bedrooms', 'Bathrooms', 'Sqft',
      'Current Rent', 'Current Tenant', 'Move-In Date',
    ],
  ];

  for (const prop of report.properties) {
    for (const unit of prop.units) {
      const currentTenant = unit.tenantHistory.find(t => t.isCurrent);
      detailRows.push([
        prop.name,
        prop.address,
        prop.city,
        prop.state,
        prop.zip,
        prop.propertyType,
        unit.unitName || '—',
        unit.bedrooms || '',
        unit.bathrooms || '',
        unit.sqft || '',
        unit.currentRent || '',
        currentTenant?.tenantName || 'Vacant',
        currentTenant ? fmtDate(currentTenant.moveInDate) : '',
      ]);
    }
  }

  const detailSheet = XLSX.utils.aoa_to_sheet(detailRows);
  detailSheet['!cols'] = [
    { wch: 25 }, { wch: 35 }, { wch: 15 }, { wch: 8 }, { wch: 10 },
    { wch: 15 }, { wch: 12 }, { wch: 10 }, { wch: 10 }, { wch: 8 },
    { wch: 12 }, { wch: 22 }, { wch: 14 },
  ];

  XLSX.utils.book_append_sheet(wb, detailSheet, 'Properties');

  // ════════════════════════════════════════════
  // Sheet 3: Full Tenant History
  // ════════════════════════════════════════════
  const historyRows: unknown[][] = [
    [
      'Property', 'Unit', 'Tenant Name', 'Status',
      'Move-In Date', 'Move-Out Date', 'Rent',
      'Lease Start', 'Lease End',
    ],
  ];

  for (const prop of report.properties) {
    for (const unit of prop.units) {
      for (const tenant of unit.tenantHistory) {
        historyRows.push([
          prop.address || prop.name,
          unit.unitName || '—',
          tenant.tenantName,
          tenant.status,
          fmtDate(tenant.moveInDate),
          fmtDate(tenant.moveOutDate),
          tenant.rent || '',
          fmtDate(tenant.leaseStartDate),
          fmtDate(tenant.leaseEndDate),
        ]);
      }
    }
  }

  const historySheet = XLSX.utils.aoa_to_sheet(historyRows);
  historySheet['!cols'] = [
    { wch: 35 }, { wch: 12 }, { wch: 22 }, { wch: 10 },
    { wch: 14 }, { wch: 14 }, { wch: 12 },
    { wch: 14 }, { wch: 14 },
  ];

  XLSX.utils.book_append_sheet(wb, historySheet, 'Tenant History');

  // Write to buffer
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  return Buffer.from(buf);
}
