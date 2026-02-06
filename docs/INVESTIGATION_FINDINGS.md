# RAG Retrieval Investigation Findings

**Date:** January 26, 2026  
**Issue:** Irrelevant ORS sections being retrieved with low similarity scores

## Investigation Summary

### Problem
The RAG system is retrieving irrelevant ORS sections (e.g., 90.113, 90.160, 90.391, 90.775, 90.860) that don't match user queries. The chatbot acknowledges this limitation and tells users it only has access to a "small portion" of ORS Chapter 90.

### Root Cause Analysis

#### 1. **Threshold Too Low (0.30)**
- Current threshold: 0.30 (30% similarity)
- This is very low and allows many low-quality matches
- Cosine similarity of 0.30 means the vectors are quite different
- **Impact:** Retrieves chunks that are semantically distant from the query

#### 2. **Limited Result Count (5 chunks)**
- Only retrieving top 5 chunks per query
- If the top 5 happen to be irrelevant, the entire context is poor
- **Impact:** No fallback if initial matches are poor quality

#### 3. **Query Expansion May Add Noise**
- Query expansion adds related terms, which could dilute the embedding
- Example: "late fees" expands to "late fees late charge late rent rent payment"
- **Impact:** Expanded query may match broader, less relevant content

#### 4. **Similarity Calculation**
- Database uses: `similarity = 1 - (embedding <=> query_embedding)`
- `<=>` is cosine distance (0 = identical, 2 = opposite)
- Threshold of 0.30 means accepting cosine distance up to 0.70
- **Impact:** Very permissive matching

### Technical Details

**Similarity Score Interpretation:**
- 1.0 = Perfect match (identical vectors)
- 0.7 = Good match
- 0.5 = Moderate match
- 0.3 = Poor match (current threshold)
- 0.0 = No similarity

**Current Behavior:**
- With threshold 0.30, chunks with only 30% similarity are included
- This is too permissive for legal text where precision matters
- Low-quality matches pollute the context and confuse the LLM

### Diagnostic Tools Created

1. **`scripts/diagnose-retrieval.mjs`**
   - Tests queries with multiple threshold values (0.30, 0.40, 0.50, 0.60, 0.70)
   - Shows similarity score distribution
   - Compares results with/without query expansion
   - Displays detailed chunk information
   - Shows database statistics

2. **Enhanced Logging in `lib/rag.ts`**
   - Logs query expansion when it occurs
   - Logs similarity score statistics (min, avg, max)
   - Logs retrieved section numbers
   - Helps debug production issues

### Recommended Solutions

#### Immediate Fixes (High Priority)

1. **Increase Threshold to 0.50-0.60**
   - Test with 0.50 first, then adjust based on results
   - This will filter out low-quality matches
   - **Risk:** May return fewer results, but quality over quantity

2. **Increase Result Count to 10-15**
   - Retrieve more chunks, then filter by quality
   - Allows fallback if top matches are poor
   - **Implementation:** Change count parameter, add post-filtering by similarity

3. **Add Minimum Similarity Filter**
   - Even if threshold is 0.30, filter results to minimum 0.45
   - Prevents very low-quality matches from being included
   - **Implementation:** Post-process results in `searchKnowledge()`

#### Medium Priority Improvements

4. **Make Query Expansion Optional or Smarter**
   - Test queries with and without expansion
   - Only expand if initial results are poor
   - Use weighted expansion (original query terms weighted higher)

5. **Hybrid Search Approach**
   - Combine vector search with keyword matching
   - Boost results that match specific ORS section numbers
   - Use BM25 or similar for keyword relevance

6. **Chunk Quality Analysis**
   - Review chunk sizes (currently 1000 chars with 200 overlap)
   - Ensure chunks contain complete legal concepts
   - Consider section-aware chunking for ORS 90

#### Long-term Improvements

7. **Re-embedding Strategy**
   - Verify all chunks were embedded correctly
   - Consider re-embedding with better chunk boundaries
   - Test different embedding models for legal text

8. **Retrieval Quality Metrics**
   - Track similarity scores over time
   - Monitor user feedback on answer quality
   - A/B test different threshold values

9. **Reranking**
   - Use a second-stage reranker to improve results
   - Cross-encoder models for better relevance
   - Consider LLM-based reranking

### Testing Plan

1. **Run Diagnostic Script**
   ```bash
   node scripts/diagnose-retrieval.mjs "late fees"
   node scripts/diagnose-retrieval.mjs "security deposit return"
   node scripts/diagnose-retrieval.mjs "eviction notice requirements"
   ```

2. **Test Different Thresholds**
   - Compare results at 0.30, 0.40, 0.50, 0.60
   - Evaluate quality vs quantity tradeoff
   - Check if relevant sections are being retrieved

3. **Monitor Production Logs**
   - Review similarity scores in production
   - Identify queries that return poor results
   - Track which sections are being retrieved

4. **User Feedback**
   - Collect feedback on answer quality
   - Identify common failure patterns
   - Track queries that return "I only see X sections" responses

### Next Steps

1. ✅ Created diagnostic script
2. ✅ Added debug logging
3. ⏳ Run diagnostic script with sample queries
4. ⏳ Test threshold adjustments (0.50, 0.60)
5. ⏳ Implement minimum similarity filter
6. ⏳ Increase result count and add filtering
7. ⏳ Test query expansion effectiveness
8. ⏳ Review chunk quality in database

### Related Files

- `lib/rag.ts` - Main RAG implementation
- `lib/supabase.ts` - Database queries
- `scripts/diagnose-retrieval.mjs` - Diagnostic tool
- `scripts/ingest.mjs` - Chunking and embedding logic
- `docs/CONTEXT_ISSUES.md` - Issue tracking
