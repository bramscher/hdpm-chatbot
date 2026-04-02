import { NextResponse } from 'next/server';
import { fetchVacantUnits } from '@/lib/appfolio-vacancies';

export { type VacantUnit } from '@/lib/appfolio-vacancies';

export async function GET() {
  try {
    const units = await fetchVacantUnits();
    return NextResponse.json({ units });
  } catch (err) {
    console.error('[appfolio-vacancies] Error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to fetch vacancies' },
      { status: 500 }
    );
  }
}
