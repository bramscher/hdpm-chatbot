import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';
import { HdmsInvoice } from './invoices';

const styles = StyleSheet.create({
  page: {
    padding: 50,
    fontSize: 10,
    fontFamily: 'Helvetica',
    color: '#1a1a1a',
  },

  // Header
  header: {
    marginBottom: 30,
    borderBottomWidth: 2,
    borderBottomColor: '#333333',
    paddingBottom: 15,
  },
  companyName: {
    fontSize: 20,
    fontFamily: 'Helvetica-Bold',
    color: '#111111',
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 10,
    color: '#666666',
  },

  // Invoice info row
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 30,
  },
  infoBlock: {
    flexDirection: 'column',
  },
  infoLabel: {
    fontSize: 8,
    color: '#888888',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 3,
    fontFamily: 'Helvetica-Bold',
  },
  infoValue: {
    fontSize: 12,
    fontFamily: 'Helvetica-Bold',
    color: '#111111',
  },
  infoValueLight: {
    fontSize: 10,
    color: '#333333',
    marginTop: 2,
  },

  // Property section
  propertySection: {
    marginBottom: 25,
    padding: 15,
    backgroundColor: '#f8f8f8',
    borderRadius: 4,
  },
  propertyLabel: {
    fontSize: 8,
    color: '#888888',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 5,
    fontFamily: 'Helvetica-Bold',
  },
  propertyName: {
    fontSize: 13,
    fontFamily: 'Helvetica-Bold',
    color: '#111111',
    marginBottom: 2,
  },
  propertyAddress: {
    fontSize: 10,
    color: '#444444',
  },

  // Description
  descriptionSection: {
    marginBottom: 25,
  },
  descriptionLabel: {
    fontSize: 8,
    color: '#888888',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
    fontFamily: 'Helvetica-Bold',
  },
  descriptionText: {
    fontSize: 10,
    color: '#333333',
    lineHeight: 1.5,
  },

  // Table
  table: {
    marginBottom: 30,
  },
  tableHeader: {
    flexDirection: 'row',
    borderBottomWidth: 2,
    borderBottomColor: '#333333',
    paddingBottom: 8,
    marginBottom: 0,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    paddingVertical: 10,
  },
  tableTotalRow: {
    flexDirection: 'row',
    borderTopWidth: 2,
    borderTopColor: '#333333',
    paddingTop: 10,
    marginTop: 5,
  },
  tableColDesc: {
    width: '70%',
  },
  tableColAmount: {
    width: '30%',
    textAlign: 'right',
  },
  tableHeaderText: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: '#888888',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  tableCellText: {
    fontSize: 10,
    color: '#333333',
  },
  tableTotalLabel: {
    fontSize: 12,
    fontFamily: 'Helvetica-Bold',
    color: '#111111',
  },
  tableTotalAmount: {
    fontSize: 14,
    fontFamily: 'Helvetica-Bold',
    color: '#111111',
    textAlign: 'right',
  },

  // Footer
  footer: {
    position: 'absolute',
    bottom: 50,
    left: 50,
    right: 50,
    textAlign: 'center',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    paddingTop: 15,
  },
  footerText: {
    fontSize: 10,
    color: '#888888',
    fontStyle: 'italic',
  },
});

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

interface InvoicePdfProps {
  invoice: HdmsInvoice;
}

/** Helper to create the PDF element for renderToBuffer.
 *  We call the component function directly so renderToBuffer
 *  receives a <Document> element at the top level instead of
 *  a wrapper component — @react-pdf/renderer requires this. */
export function createInvoicePdfElement(invoice: HdmsInvoice) {
  return InvoicePdfDocument({ invoice });
}

export function InvoicePdfDocument({ invoice }: InvoicePdfProps) {
  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.companyName}>High Desert Maintenance Services</Text>
          <Text style={styles.subtitle}>Internal Division of High Desert Property Management</Text>
        </View>

        {/* Invoice Info */}
        <View style={styles.infoRow}>
          <View style={styles.infoBlock}>
            <Text style={styles.infoLabel}>Invoice Number</Text>
            <Text style={styles.infoValue}>{invoice.invoice_code}</Text>
          </View>
          <View style={styles.infoBlock}>
            <Text style={styles.infoLabel}>Date</Text>
            <Text style={styles.infoValue}>{formatDate(invoice.completed_date)}</Text>
          </View>
          {invoice.wo_reference ? (
            <View style={styles.infoBlock}>
              <Text style={styles.infoLabel}>Work Order</Text>
              <Text style={styles.infoValue}>{invoice.wo_reference}</Text>
            </View>
          ) : null}
        </View>

        {/* Property */}
        <View style={styles.propertySection}>
          <Text style={styles.propertyLabel}>Service Location</Text>
          <Text style={styles.propertyName}>{invoice.property_name}</Text>
          <Text style={styles.propertyAddress}>{invoice.property_address}</Text>
        </View>

        {/* Description */}
        <View style={styles.descriptionSection}>
          <Text style={styles.descriptionLabel}>Description of Work</Text>
          <Text style={styles.descriptionText}>{invoice.description}</Text>
        </View>

        {/* Line Items Table */}
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <View style={styles.tableColDesc}>
              <Text style={styles.tableHeaderText}>Item</Text>
            </View>
            <View style={styles.tableColAmount}>
              <Text style={styles.tableHeaderText}>Amount</Text>
            </View>
          </View>

          {invoice.labor_amount > 0 ? (
            <View style={styles.tableRow}>
              <View style={styles.tableColDesc}>
                <Text style={styles.tableCellText}>Labor</Text>
              </View>
              <View style={styles.tableColAmount}>
                <Text style={styles.tableCellText}>{formatCurrency(invoice.labor_amount)}</Text>
              </View>
            </View>
          ) : null}

          {invoice.materials_amount > 0 ? (
            <View style={styles.tableRow}>
              <View style={styles.tableColDesc}>
                <Text style={styles.tableCellText}>Materials</Text>
              </View>
              <View style={styles.tableColAmount}>
                <Text style={styles.tableCellText}>{formatCurrency(invoice.materials_amount)}</Text>
              </View>
            </View>
          ) : null}

          <View style={styles.tableTotalRow}>
            <View style={styles.tableColDesc}>
              <Text style={styles.tableTotalLabel}>Total</Text>
            </View>
            <View style={styles.tableColAmount}>
              <Text style={styles.tableTotalAmount}>{formatCurrency(invoice.total_amount)}</Text>
            </View>
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>Thank you for your business.</Text>
        </View>
      </Page>
    </Document>
  );
}
