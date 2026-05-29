/**
 * Service-to-service callback into hdpm-web's CRM.
 *
 * Used to update a Lead's rentAnalysisStatus when an owner-intake
 * rent analysis transitions states (in_review, delivered, declined)
 * so the operations team sees progress in the web admin.
 */

const HDPM_WEB_BASE_URL = process.env.HDPM_WEB_BASE_URL || '';
const HDPM_SERVICE_TOKEN = process.env.HDPM_SERVICE_TOKEN || '';

export type LeadAnalysisStatus = 'requested' | 'in_review' | 'delivered' | 'declined';

export interface NotifyWebRentAnalysisInput {
  lead_id: number;
  rent_analysis_id: string;
  status: LeadAnalysisStatus;
  short_url?: string;
}

export async function notifyWebRentAnalysisStatus(
  input: NotifyWebRentAnalysisInput
): Promise<{ ok: boolean; error?: string }> {
  if (!HDPM_WEB_BASE_URL || !HDPM_SERVICE_TOKEN) {
    return {
      ok: false,
      error: 'HDPM_WEB_BASE_URL or HDPM_SERVICE_TOKEN not configured',
    };
  }

  try {
    const res = await fetch(
      `${HDPM_WEB_BASE_URL.replace(/\/$/, '')}/api/crm/rental-analysis/status`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${HDPM_SERVICE_TOKEN}`,
        },
        body: JSON.stringify(input),
      }
    );

    if (!res.ok) {
      const text = await res.text();
      return { ok: false, error: `web ${res.status}: ${text.slice(0, 200)}` };
    }
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
