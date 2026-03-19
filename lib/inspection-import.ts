import * as XLSX from 'xlsx';
import { getSupabaseAdmin } from '@/lib/supabase';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ParsedFile {
  headers: string[];
  rows: Record<string, string>[];
  totalRows: number;
}

export interface ValidatedRow {
  rowNumber: number;
  data: Record<string, string>;
  status: 'valid' | 'warning' | 'error' | 'duplicate';
  issues: string[];
}

export interface ValidationResult {
  valid: ValidatedRow[];
  warnings: ValidatedRow[];
  errors: ValidatedRow[];
  duplicates: ValidatedRow[];
}

export interface CommitResult {
  created: number;
  properties_created: number;
  properties_matched: number;
}

// ---------------------------------------------------------------------------
// Central Oregon city-to-ZIP lookup
// ---------------------------------------------------------------------------

const CITY_ZIPS: Record<string, string> = {
  'bend': '97701',
  'redmond': '97756',
  'sisters': '97759',
  'prineville': '97754',
  'la pine': '97739',
  'madras': '97741',
  'metolius': '97741',
  'terrebonne': '97760',
  'tumalo': '97703',
  'sunriver': '97707',
  'powell butte': '97753',
  'crooked river ranch': '97760',
};

// ---------------------------------------------------------------------------
// parseInspectionFile
// ---------------------------------------------------------------------------

export function parseInspectionFile(buffer: Buffer, filename: string): ParsedFile {
  const ext = filename.toLowerCase().split('.').pop();

  let workbook: XLSX.WorkBook;

  if (ext === 'csv') {
    const text = buffer.toString('utf-8');
    workbook = XLSX.read(text, { type: 'string' });
  } else {
    // XLSX / XLS
    workbook = XLSX.read(buffer, { type: 'buffer' });
  }

  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    return { headers: [], rows: [], totalRows: 0 };
  }

  const sheet = workbook.Sheets[sheetName];
  const rawRows: Record<string, string>[] = XLSX.utils.sheet_to_json(sheet, {
    defval: '',
    raw: false,
  });

  if (rawRows.length === 0) {
    return { headers: [], rows: [], totalRows: 0 };
  }

  const headers = Object.keys(rawRows[0]);

  // Strip blank separator rows (all values null/empty/whitespace)
  const rows = rawRows.filter((row) =>
    Object.values(row).some((v) => v !== null && v !== undefined && String(v).trim() !== '')
  );

  return { headers, rows, totalRows: rows.length };
}

// ---------------------------------------------------------------------------
// validateInspectionRows
// ---------------------------------------------------------------------------

export function validateInspectionRows(
  rows: Record<string, string>[],
  columnMapping: Record<string, string>
): ValidationResult {
  const valid: ValidatedRow[] = [];
  const warnings: ValidatedRow[] = [];
  const errors: ValidatedRow[] = [];
  const duplicates: ValidatedRow[] = [];

  // Track address+city combos for duplicate detection
  const seen = new Map<string, number>(); // key -> first row number
  const duplicateKeys = new Set<string>();

  // First pass: detect duplicates
  rows.forEach((row, idx) => {
    const address = getMapped(row, columnMapping, 'address_1');
    const city = getMapped(row, columnMapping, 'city');
    const key = `${address.toLowerCase().trim()}|${city.toLowerCase().trim()}`;

    if (seen.has(key)) {
      duplicateKeys.add(key);
    } else {
      seen.set(key, idx + 1);
    }
  });

  // Second pass: validate each row
  rows.forEach((row, idx) => {
    const rowNumber = idx + 1;
    const issues: string[] = [];

    const address = getMapped(row, columnMapping, 'address_1');
    const city = getMapped(row, columnMapping, 'city');
    const inspectionType = getMapped(row, columnMapping, 'inspection_type') || 'annual';
    const state = getMapped(row, columnMapping, 'state') || 'OR';
    let zip = getMapped(row, columnMapping, 'zip');
    const dueDateRaw = getMapped(row, columnMapping, 'due_date');
    const lastInspectionRaw = getMapped(row, columnMapping, 'last_inspection_date');

    // --- Required field checks ---
    if (!address.trim()) {
      issues.push('Missing required field: address_1');
    }
    if (!city.trim()) {
      issues.push('Missing required field: city');
    }

    // If there are missing required fields, it is an error
    if (issues.length > 0) {
      errors.push({ rowNumber, data: buildRowData(row, columnMapping, inspectionType, state, zip), status: 'error', issues });
      return;
    }

    // --- ZIP default from city lookup ---
    if (!zip.trim()) {
      const cityLower = city.toLowerCase().trim();
      if (CITY_ZIPS[cityLower]) {
        zip = CITY_ZIPS[cityLower];
      }
      // zip is optional; will be geocoded later if still missing
    }

    // --- Due date calculation ---
    let dueDate = dueDateRaw.trim();
    if (!dueDate) {
      if (lastInspectionRaw.trim()) {
        const lastDate = new Date(lastInspectionRaw.trim());
        if (!isNaN(lastDate.getTime())) {
          lastDate.setDate(lastDate.getDate() + 365);
          dueDate = lastDate.toISOString().split('T')[0];
        }
      }
      if (!dueDate) {
        const fallback = new Date();
        fallback.setDate(fallback.getDate() + 30);
        dueDate = fallback.toISOString().split('T')[0];
      }
    }

    const data = buildRowData(row, columnMapping, inspectionType, state, zip);
    data.due_date = dueDate;

    // --- Duplicate check ---
    const key = `${address.toLowerCase().trim()}|${city.toLowerCase().trim()}`;
    if (duplicateKeys.has(key)) {
      duplicates.push({ rowNumber, data, status: 'duplicate', issues: ['Duplicate address_1 + city combination in import'] });
      return;
    }

    // --- Warning: missing due_date from source ---
    if (!dueDateRaw.trim() && !lastInspectionRaw.trim()) {
      issues.push('Missing due_date and last_inspection_date; defaulting due_date to today + 30 days');
    }

    if (issues.length > 0) {
      warnings.push({ rowNumber, data, status: 'warning', issues });
    } else {
      valid.push({ rowNumber, data, status: 'valid', issues: [] });
    }
  });

  return { valid, warnings, errors, duplicates };
}

// ---------------------------------------------------------------------------
// commitInspectionImport
// ---------------------------------------------------------------------------

export async function commitInspectionImport(
  batchId: string,
  selectedRows: ValidatedRow[],
  uploadedBy: string
): Promise<CommitResult> {
  const supabase = getSupabaseAdmin();

  let propertiesCreated = 0;
  let propertiesMatched = 0;
  let inspectionsCreated = 0;

  for (const row of selectedRows) {
    const { data } = row;
    const address1 = data.address_1?.trim();
    const city = data.city?.trim();
    const zip = data.zip?.trim() || null;
    const state = data.state?.trim() || 'OR';

    // Upsert inspection_properties on address_1 + city + zip
    const { data: existingProps, error: lookupErr } = await supabase
      .from('inspection_properties')
      .select('id')
      .eq('address_1', address1)
      .eq('city', city)
      .limit(1);

    if (lookupErr) {
      console.error('Property lookup error:', lookupErr);
      throw new Error(`Property lookup failed: ${lookupErr.message}`);
    }

    let propertyId: string;

    if (existingProps && existingProps.length > 0) {
      propertyId = existingProps[0].id;
      propertiesMatched++;
    } else {
      const { data: newProp, error: insertErr } = await supabase
        .from('inspection_properties')
        .insert({
          address_1: address1,
          city,
          state,
          zip,
        })
        .select('id')
        .single();

      if (insertErr) {
        console.error('Property insert error:', insertErr);
        throw new Error(`Property insert failed: ${insertErr.message}`);
      }

      propertyId = newProp.id;
      propertiesCreated++;
    }

    // Create inspection record
    const { error: inspErr } = await supabase
      .from('inspections')
      .insert({
        property_id: propertyId,
        inspection_type: data.inspection_type || 'annual',
        status: 'pending',
        due_date: data.due_date || null,
        import_batch_id: batchId,
        created_by: uploadedBy,
      });

    if (inspErr) {
      console.error('Inspection insert error:', inspErr);
      throw new Error(`Inspection insert failed: ${inspErr.message}`);
    }

    inspectionsCreated++;
  }

  // Update import_batches status
  const { error: batchErr } = await supabase
    .from('import_batches')
    .update({
      status: 'committed',
      committed_at: new Date().toISOString(),
      committed_by: uploadedBy,
      records_created: inspectionsCreated,
    })
    .eq('id', batchId);

  if (batchErr) {
    console.error('Batch update error:', batchErr);
    throw new Error(`Batch update failed: ${batchErr.message}`);
  }

  return {
    created: inspectionsCreated,
    properties_created: propertiesCreated,
    properties_matched: propertiesMatched,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getMapped(
  row: Record<string, string>,
  mapping: Record<string, string>,
  targetField: string
): string {
  const sourceColumn = mapping[targetField];
  if (!sourceColumn) return '';
  const val = row[sourceColumn];
  return val !== null && val !== undefined ? String(val) : '';
}

function buildRowData(
  row: Record<string, string>,
  mapping: Record<string, string>,
  inspectionType: string,
  state: string,
  zip: string
): Record<string, string> {
  const data: Record<string, string> = {};

  // Map all columns from the mapping
  for (const [target, source] of Object.entries(mapping)) {
    const val = row[source];
    data[target] = val !== null && val !== undefined ? String(val).trim() : '';
  }

  // Apply defaults
  data.inspection_type = data.inspection_type || inspectionType;
  data.state = data.state || state;
  data.zip = data.zip || zip;

  return data;
}
