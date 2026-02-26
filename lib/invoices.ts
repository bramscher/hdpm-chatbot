import { getSupabaseAdmin } from './supabase';

// ============================================
// Types
// ============================================

export interface HdmsInvoice {
  id: string;
  invoice_number: number;
  invoice_code: string;
  status: 'draft' | 'generated' | 'attached' | 'void';
  property_name: string;
  property_address: string;
  wo_reference: string | null;
  completed_date: string | null;
  description: string;
  labor_amount: number;
  materials_amount: number;
  total_amount: number;
  internal_notes: string | null;
  pdf_path: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface CreateInvoiceInput {
  property_name: string;
  property_address: string;
  wo_reference?: string;
  completed_date?: string;
  description: string;
  labor_amount: number;
  materials_amount: number;
  total_amount: number;
  internal_notes?: string;
  created_by: string;
}

export interface UpdateInvoiceInput {
  status?: HdmsInvoice['status'];
  property_name?: string;
  property_address?: string;
  wo_reference?: string;
  completed_date?: string;
  description?: string;
  labor_amount?: number;
  materials_amount?: number;
  total_amount?: number;
  internal_notes?: string;
  pdf_path?: string;
}

/** Represents a parsed row from the AppFolio CSV export */
export interface WorkOrderRow {
  wo_number: string;
  property_name: string;
  property_address: string;
  unit: string;
  description: string;
  completed_date: string;
  category: string;
  assigned_to: string;
  [key: string]: string;
}

// ============================================
// Database Operations
// ============================================

export async function createInvoice(input: CreateInvoiceInput): Promise<HdmsInvoice> {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from('hdms_invoices')
    .insert({
      property_name: input.property_name,
      property_address: input.property_address,
      wo_reference: input.wo_reference || null,
      completed_date: input.completed_date || null,
      description: input.description,
      labor_amount: input.labor_amount,
      materials_amount: input.materials_amount,
      total_amount: input.total_amount,
      internal_notes: input.internal_notes || null,
      created_by: input.created_by,
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating invoice:', error);
    throw new Error(`Failed to create invoice: ${error.message}`);
  }

  return data as HdmsInvoice;
}

export async function getInvoices(limit = 50, offset = 0): Promise<HdmsInvoice[]> {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from('hdms_invoices')
    .select('*')
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    console.error('Error fetching invoices:', error);
    throw new Error(`Failed to fetch invoices: ${error.message}`);
  }

  return data as HdmsInvoice[];
}

export async function getInvoiceById(id: string): Promise<HdmsInvoice | null> {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from('hdms_invoices')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    console.error('Error fetching invoice:', error);
    throw new Error(`Failed to fetch invoice: ${error.message}`);
  }

  return data as HdmsInvoice;
}

export async function updateInvoice(id: string, input: UpdateInvoiceInput): Promise<HdmsInvoice> {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from('hdms_invoices')
    .update(input)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Error updating invoice:', error);
    throw new Error(`Failed to update invoice: ${error.message}`);
  }

  return data as HdmsInvoice;
}

// ============================================
// Storage Operations
// ============================================

export async function uploadInvoicePdf(
  pdfBuffer: Uint8Array,
  invoice: HdmsInvoice
): Promise<string> {
  const supabase = getSupabaseAdmin();

  const date = new Date(invoice.created_at);
  const year = date.getFullYear().toString();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const sanitizedName = invoice.property_name.replace(/[^a-zA-Z0-9]/g, '-').replace(/-+/g, '-');
  const dateStr = invoice.completed_date || date.toISOString().split('T')[0];

  const path = `${year}/${month}/${invoice.invoice_code}_${sanitizedName}_${dateStr}.pdf`;

  const { error } = await supabase.storage
    .from('hdms-invoices')
    .upload(path, pdfBuffer, {
      contentType: 'application/pdf',
      upsert: true,
    });

  if (error) {
    console.error('Error uploading PDF:', error);
    throw new Error(`Failed to upload PDF: ${error.message}`);
  }

  return path;
}

export async function getInvoicePdfSignedUrl(path: string): Promise<string> {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase.storage
    .from('hdms-invoices')
    .createSignedUrl(path, 3600); // 1 hour expiry

  if (error) {
    console.error('Error creating signed URL:', error);
    throw new Error(`Failed to create download URL: ${error.message}`);
  }

  return data.signedUrl;
}
