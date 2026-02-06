# Context Issues Documentation

**Date:** January 26, 2026  
**SharePoint Reference:** https://hdpm.sharepoint.com/sites/HighDesertPropertyManagement

## Overview

This document tracks issues related to the chatbot's context handling, RAG (Retrieval-Augmented Generation) performance, and knowledge base retrieval accuracy.

## Current RAG Implementation

- **Embedding Model:** OpenAI text-embedding-3-small (1536 dimensions)
- **Search Threshold:** 0.30 (lowered from 0.7 for better recall)
- **Result Count:** Top 5 chunks
- **Query Expansion:** Enabled for common terms (deposits, evictions, repairs, etc.)
- **Knowledge Base:** ORS Chapter 90 (163 sections), Loom videos, policy documents

## Known Issues

### Issue #1: Irrelevant ORS Sections Being Retrieved (Reported: Feb 6, 2026)

**Problem:** The RAG system is retrieving irrelevant ORS sections that don't match the user's query. The chatbot acknowledges this limitation in its responses.

**Example Output:**
```
Currently Available ORS 90 Sections:
- ORS 90.113 - Additional exclusion from application of chapter
- ORS 90.160 - Calculation of periods or notices
- ORS 90.391 - Information to veterans required in notice
- ORS 90.775 - Rules
- ORS 90.860 - Definitions for ORS 90.865 to 90.875
```

**Symptoms:**
- Only 5 chunks retrieved (as configured)
- Retrieved sections appear random/unrelated to query
- Chatbot explicitly states it only has access to a "small portion" of ORS Chapter 90
- Chatbot suggests users query with specific topics/section numbers

**Potential Causes:**
1. **Embedding Quality:** The embeddings in the knowledge base may not accurately represent the semantic content
2. **Query Embedding Mismatch:** User query embeddings may not align well with stored chunk embeddings
3. **Threshold Too Low:** 0.30 threshold may be retrieving too many low-quality matches
4. **Chunk Size/Content:** The chunks may be too small/large or poorly structured
5. **Query Expansion Issues:** Query expansion may be adding noise rather than improving matches

**Investigation Needed:**
- Check actual similarity scores of retrieved chunks
- Verify embedding generation process for knowledge base chunks
- Test with different threshold values (0.4, 0.5, 0.6)
- Review chunk content and structure in database
- Test query expansion effectiveness
- Consider increasing result count from 5 to 10-15 and filtering by relevance

**Code Location:**
- `lib/rag.ts` lines 173 and 340: Hardcoded threshold of 0.30
- `lib/rag.ts` line 127-136: `searchKnowledge()` function with query expansion
- `lib/supabase.ts` line 88-107: `searchKnowledgeChunks()` RPC call

## Areas to Investigate

1. **Context Retrieval Accuracy**
   - Are relevant chunks being retrieved for user queries?
   - Is the similarity threshold (0.30) optimal?
   - Are query expansions helping or hurting?

2. **Context Window Management**
   - Is the context being built correctly from retrieved chunks?
   - Are citations matching correctly with sources?
   - Is the context too long/short for Claude?

3. **Document Analysis Mode**
   - How well does document analysis work with context?
   - Is the document content properly prioritized over knowledge base context?

4. **Response Quality**
   - Are citations accurate and helpful?
   - Is the AI using the context appropriately?
   - Are responses staying within the provided context?

## Related Files

- `lib/rag.ts` - Main RAG implementation
- `app/api/chat/stream/route.ts` - Streaming chat endpoint
- `app/api/chat/route.ts` - Non-streaming chat endpoint

## Potential Solutions

### For Issue #1: Irrelevant ORS Sections

1. **Increase Result Count & Filter**
   - Retrieve 10-15 chunks instead of 5
   - Filter results by minimum similarity (e.g., > 0.5)
   - Sort by similarity descending

2. **Improve Query Processing**
   - Add query preprocessing (remove stop words, normalize)
   - Consider hybrid search (vector + keyword)
   - Test without query expansion to see if it's causing issues

3. **Review Embedding Strategy**
   - Verify all chunks were embedded correctly
   - Consider re-embedding with different chunk sizes
   - Test embedding model performance on legal text

4. **Add Debugging**
   - Log similarity scores for retrieved chunks
   - Log the actual query used (after expansion)
   - Add metrics to track retrieval quality

5. **Threshold Tuning**
   - Test different thresholds: 0.4, 0.5, 0.6
   - Consider dynamic threshold based on query type
   - Implement minimum similarity floor

## Notes

- SharePoint site contains additional context and user feedback
- Regular updates should be made as issues are identified and resolved
- Consider implementing retrieval quality metrics and monitoring
