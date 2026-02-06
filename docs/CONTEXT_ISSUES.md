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

### To be documented from SharePoint site
_Issues and problems should be added here based on feedback from the SharePoint site and user reports._

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

## Notes

- SharePoint site contains additional context and user feedback
- Regular updates should be made as issues are identified and resolved
