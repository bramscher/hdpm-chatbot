import { NextRequest, NextResponse } from 'next/server';
import { saveListing, listSavedListings, deleteSavedListing } from '@/lib/saved-listings';

export async function GET() {
  try {
    const listings = await listSavedListings();
    return NextResponse.json({ listings });
  } catch (err) {
    console.error('[saved-listings] GET error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to fetch listings' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const listing = await saveListing(body);
    return NextResponse.json({ listing });
  } catch (err) {
    console.error('[saved-listings] POST error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to save listing' },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { id } = await req.json();
    if (!id) {
      return NextResponse.json({ error: 'id required' }, { status: 400 });
    }
    await deleteSavedListing(id);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[saved-listings] DELETE error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to delete listing' },
      { status: 500 }
    );
  }
}
