#!/bin/bash

# Complete ORS Chapter 90 Ingestion Script
# This script clears existing ORS 90 data and re-ingests all sections
# from the official Oregon Legislature sources.

set -e

cd "$(dirname "$0")/.."

echo "=============================================="
echo "  Complete ORS Chapter 90 Ingestion"
echo "=============================================="
echo ""

# Step 1: Clear existing ORS 90 data
echo "Step 1: Clearing existing ORS 90 data..."
node scripts/clear-ors90-data.mjs --confirm

echo ""
echo "=============================================="
echo "Step 2: Ingesting all ORS 90 sections..."
echo "=============================================="
echo ""

# Process all sections in one go (169 sections)
# This will take approximately 15-20 minutes
node scripts/fetch-ors90-complete.mjs 0 200

echo ""
echo "=============================================="
echo "  Ingestion Complete!"
echo "=============================================="
echo ""
echo "The knowledge base now contains the complete"
echo "Oregon ORS Chapter 90 (Residential Landlord"
echo "and Tenant Act) with accurate citations."
echo ""
