import { Source } from '@/components/Message';

export interface ExportData {
  documentName?: string;
  documentContent?: string;
  aiResponse: string;
  sources: Source[];
  timestamp: Date;
}

/**
 * Format the export data as plain text for email/clipboard
 */
export function formatAsText(data: ExportData): string {
  const lines: string[] = [];

  // Header
  lines.push('═══════════════════════════════════════════════════════════════');
  lines.push('HIGH DESERT PROPERTY MANAGEMENT');
  lines.push('Oregon Landlord-Tenant Law Analysis');
  lines.push(`Generated: ${data.timestamp.toLocaleString()}`);
  lines.push('═══════════════════════════════════════════════════════════════');
  lines.push('');

  // Original document (if provided)
  if (data.documentName && data.documentContent) {
    lines.push('───────────────────────────────────────────────────────────────');
    lines.push(`ORIGINAL DOCUMENT: ${data.documentName}`);
    lines.push('───────────────────────────────────────────────────────────────');
    lines.push('');
    lines.push(data.documentContent);
    lines.push('');
  }

  // AI Response
  lines.push('───────────────────────────────────────────────────────────────');
  lines.push('LEGAL ANALYSIS');
  lines.push('───────────────────────────────────────────────────────────────');
  lines.push('');
  // Strip markdown formatting for plain text
  const plainResponse = data.aiResponse
    .replace(/^## /gm, '')
    .replace(/^### /gm, '')
    .replace(/\*\*/g, '')
    .replace(/\[(\d+)\]/g, '[$1]'); // Keep citation numbers
  lines.push(plainResponse);
  lines.push('');

  // Sources
  if (data.sources.length > 0) {
    lines.push('───────────────────────────────────────────────────────────────');
    lines.push('LEGAL SOURCES CITED');
    lines.push('───────────────────────────────────────────────────────────────');
    lines.push('');
    data.sources.forEach((source, index) => {
      lines.push(`[${index + 1}] ${source.title}`);
      if (source.section) {
        lines.push(`    ORS ${source.section}`);
      }
      lines.push(`    ${source.url}`);
      lines.push('');
    });
  }

  lines.push('═══════════════════════════════════════════════════════════════');
  lines.push('This analysis is provided for informational purposes only.');
  lines.push('Consult legal counsel for specific legal advice.');
  lines.push('═══════════════════════════════════════════════════════════════');

  return lines.join('\n');
}

/**
 * Format the export data as HTML for PDF generation
 */
export function formatAsHTML(data: ExportData): string {
  const formatMarkdown = (text: string): string => {
    return text
      .replace(/^## (.+)$/gm, '<h2 style="color: #92400e; margin-top: 16px; margin-bottom: 8px; font-size: 16px;">$1</h2>')
      .replace(/^### (.+)$/gm, '<h3 style="color: #78350f; margin-top: 12px; margin-bottom: 4px; font-size: 14px;">$1</h3>')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/^- (.+)$/gm, '<li style="margin-left: 20px;">$1</li>')
      .replace(/\[(\d+)\]/g, '<sup style="color: #d97706; font-weight: bold;">[$1]</sup>')
      .replace(/\n\n/g, '</p><p style="margin-bottom: 12px;">')
      .replace(/\n/g, '<br/>');
  };

  let html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Legal Analysis - High Desert Property Management</title>
      <style>
        body {
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          font-size: 12px;
          line-height: 1.6;
          color: #1f2937;
          max-width: 800px;
          margin: 0 auto;
          padding: 40px;
        }
        .header {
          text-align: center;
          border-bottom: 3px solid #d97706;
          padding-bottom: 20px;
          margin-bottom: 30px;
        }
        .header h1 {
          color: #92400e;
          font-size: 24px;
          margin: 0;
        }
        .header p {
          color: #78350f;
          margin: 8px 0 0;
        }
        .timestamp {
          color: #6b7280;
          font-size: 11px;
        }
        .section {
          margin-bottom: 30px;
        }
        .section-title {
          background: #fef3c7;
          color: #92400e;
          padding: 8px 16px;
          font-weight: bold;
          font-size: 14px;
          border-left: 4px solid #d97706;
          margin-bottom: 16px;
        }
        .document-content {
          background: #f9fafb;
          border: 1px solid #e5e7eb;
          padding: 16px;
          border-radius: 8px;
          white-space: pre-wrap;
          font-family: 'Courier New', monospace;
          font-size: 11px;
        }
        .analysis-content {
          padding: 0 16px;
        }
        .analysis-content p {
          margin-bottom: 12px;
        }
        .sources-list {
          list-style: none;
          padding: 0;
        }
        .source-item {
          background: #fffbeb;
          border: 1px solid #fde68a;
          border-radius: 8px;
          padding: 12px 16px;
          margin-bottom: 12px;
        }
        .source-number {
          display: inline-block;
          background: #fbbf24;
          color: #78350f;
          width: 24px;
          height: 24px;
          border-radius: 4px;
          text-align: center;
          line-height: 24px;
          font-weight: bold;
          margin-right: 12px;
        }
        .source-title {
          font-weight: bold;
          color: #92400e;
        }
        .source-section {
          color: #d97706;
          font-size: 11px;
        }
        .source-url {
          color: #6b7280;
          font-size: 10px;
          word-break: break-all;
        }
        .footer {
          margin-top: 40px;
          padding-top: 20px;
          border-top: 1px solid #e5e7eb;
          text-align: center;
          color: #6b7280;
          font-size: 10px;
        }
        @media print {
          body { padding: 20px; }
          .section { page-break-inside: avoid; }
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>High Desert Property Management</h1>
        <p>Oregon Landlord-Tenant Law Analysis</p>
        <p class="timestamp">Generated: ${data.timestamp.toLocaleString()}</p>
      </div>
  `;

  // Original document
  if (data.documentName && data.documentContent) {
    html += `
      <div class="section">
        <div class="section-title">ORIGINAL DOCUMENT: ${escapeHTML(data.documentName)}</div>
        <div class="document-content">${escapeHTML(data.documentContent)}</div>
      </div>
    `;
  }

  // AI Response
  html += `
    <div class="section">
      <div class="section-title">LEGAL ANALYSIS</div>
      <div class="analysis-content">
        <p>${formatMarkdown(data.aiResponse)}</p>
      </div>
    </div>
  `;

  // Sources
  if (data.sources.length > 0) {
    html += `
      <div class="section">
        <div class="section-title">LEGAL SOURCES CITED</div>
        <ul class="sources-list">
    `;
    data.sources.forEach((source, index) => {
      html += `
        <li class="source-item">
          <span class="source-number">${index + 1}</span>
          <span class="source-title">${escapeHTML(source.title)}</span>
          ${source.section ? `<br/><span class="source-section">ORS ${escapeHTML(source.section)}</span>` : ''}
          <br/><span class="source-url">${escapeHTML(source.url)}</span>
        </li>
      `;
    });
    html += `
        </ul>
      </div>
    `;
  }

  html += `
      <div class="footer">
        <p>This analysis is provided for informational purposes only.<br/>
        Consult legal counsel for specific legal advice.</p>
        <p>High Desert Property Management &bull; Internal Use Only</p>
      </div>
    </body>
    </html>
  `;

  return html;
}

function escapeHTML(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Copy text to clipboard
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (error) {
    console.error('Failed to copy to clipboard:', error);
    // Fallback for older browsers
    try {
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.position = 'fixed';
      textArea.style.left = '-999999px';
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      return true;
    } catch (fallbackError) {
      console.error('Fallback copy also failed:', fallbackError);
      return false;
    }
  }
}

/**
 * Format just the body content for PDF (without full HTML document structure)
 */
function formatPDFContent(data: ExportData): string {
  const formatMarkdown = (text: string): string => {
    return text
      .replace(/^## (.+)$/gm, '<h2 style="color: #92400e; margin-top: 16px; margin-bottom: 8px; font-size: 16px;">$1</h2>')
      .replace(/^### (.+)$/gm, '<h3 style="color: #78350f; margin-top: 12px; margin-bottom: 4px; font-size: 14px;">$1</h3>')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/^- (.+)$/gm, '<li style="margin-left: 20px;">$1</li>')
      .replace(/\[(\d+)\]/g, '<sup style="color: #d97706; font-weight: bold;">[$1]</sup>')
      .replace(/\n\n/g, '</p><p style="margin-bottom: 12px;">')
      .replace(/\n/g, '<br/>');
  };

  let html = `
    <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; font-size: 12px; line-height: 1.6; color: #1f2937; max-width: 800px; margin: 0 auto; padding: 20px;">
      <div style="text-align: center; border-bottom: 3px solid #d97706; padding-bottom: 20px; margin-bottom: 30px;">
        <h1 style="color: #92400e; font-size: 24px; margin: 0;">High Desert Property Management</h1>
        <p style="color: #78350f; margin: 8px 0 0;">Oregon Landlord-Tenant Law Analysis</p>
        <p style="color: #6b7280; font-size: 11px;">Generated: ${data.timestamp.toLocaleString()}</p>
      </div>
  `;

  // Original document
  if (data.documentName && data.documentContent) {
    html += `
      <div style="margin-bottom: 30px;">
        <div style="background: #fef3c7; color: #92400e; padding: 8px 16px; font-weight: bold; font-size: 14px; border-left: 4px solid #d97706; margin-bottom: 16px;">ORIGINAL DOCUMENT: ${escapeHTML(data.documentName)}</div>
        <div style="background: #f9fafb; border: 1px solid #e5e7eb; padding: 16px; border-radius: 8px; white-space: pre-wrap; font-family: 'Courier New', monospace; font-size: 11px; max-height: 300px; overflow: hidden;">${escapeHTML(data.documentContent.substring(0, 2000))}${data.documentContent.length > 2000 ? '...' : ''}</div>
      </div>
    `;
  }

  // AI Response
  html += `
    <div style="margin-bottom: 30px;">
      <div style="background: #fef3c7; color: #92400e; padding: 8px 16px; font-weight: bold; font-size: 14px; border-left: 4px solid #d97706; margin-bottom: 16px;">LEGAL ANALYSIS</div>
      <div style="padding: 0 16px;">
        <p style="margin-bottom: 12px;">${formatMarkdown(data.aiResponse)}</p>
      </div>
    </div>
  `;

  // Sources
  if (data.sources.length > 0) {
    html += `
      <div style="margin-bottom: 30px;">
        <div style="background: #fef3c7; color: #92400e; padding: 8px 16px; font-weight: bold; font-size: 14px; border-left: 4px solid #d97706; margin-bottom: 16px;">LEGAL SOURCES CITED</div>
        <ul style="list-style: none; padding: 0; margin: 0;">
    `;
    data.sources.forEach((source, index) => {
      html += `
        <li style="background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 12px 16px; margin-bottom: 12px;">
          <span style="display: inline-block; background: #fbbf24; color: #78350f; width: 24px; height: 24px; border-radius: 4px; text-align: center; line-height: 24px; font-weight: bold; margin-right: 12px;">${index + 1}</span>
          <span style="font-weight: bold; color: #92400e;">${escapeHTML(source.title)}</span>
          ${source.section ? `<br/><span style="color: #d97706; font-size: 11px;">ORS ${escapeHTML(source.section)}</span>` : ''}
          <br/><span style="color: #6b7280; font-size: 10px; word-break: break-all;">${escapeHTML(source.url)}</span>
        </li>
      `;
    });
    html += `
        </ul>
      </div>
    `;
  }

  html += `
      <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center; color: #6b7280; font-size: 10px;">
        <p>This analysis is provided for informational purposes only.<br/>
        Consult legal counsel for specific legal advice.</p>
        <p>High Desert Property Management &bull; Internal Use Only</p>
      </div>
    </div>
  `;

  return html;
}

/**
 * Export as PDF using html2pdf
 */
export async function exportToPDF(data: ExportData): Promise<void> {
  // Dynamic import to avoid SSR issues
  const html2pdf = (await import('html2pdf.js')).default;

  // Get just the body content (not full HTML document)
  const htmlContent = formatPDFContent(data);

  // Create a temporary container - must be visible for html2canvas to work
  const container = document.createElement('div');
  container.innerHTML = htmlContent;
  container.style.position = 'fixed';
  container.style.top = '0';
  container.style.left = '0';
  container.style.width = '800px';
  container.style.background = 'white';
  container.style.zIndex = '-1'; // Behind everything
  container.style.opacity = '0'; // Invisible but still rendered
  container.style.pointerEvents = 'none';
  document.body.appendChild(container);

  // Wait a frame for the DOM to render
  await new Promise(resolve => requestAnimationFrame(resolve));

  const filename = data.documentName
    ? `Analysis_${data.documentName.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}.pdf`
    : `Legal_Analysis_${Date.now()}.pdf`;

  const opt = {
    margin: [0.5, 0.5, 0.5, 0.5],
    filename,
    image: { type: 'jpeg' as const, quality: 0.98 },
    html2canvas: {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
      onclone: (clonedDoc: Document) => {
        // Ensure the cloned element is visible
        const clonedElement = clonedDoc.body.firstElementChild as HTMLElement;
        if (clonedElement) {
          clonedElement.style.opacity = '1';
          clonedElement.style.position = 'static';
        }
      }
    },
    jsPDF: { unit: 'in' as const, format: 'letter', orientation: 'portrait' as const },
    pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
  };

  try {
    await html2pdf().set(opt).from(container).save();
  } finally {
    document.body.removeChild(container);
  }
}
