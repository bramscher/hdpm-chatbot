import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Types for our knowledge base
export interface KnowledgeChunk {
  id: string;
  content: string;
  source_type: 'ors_90' | 'loom_video' | 'policy_doc';
  source_title: string;
  source_url: string;
  source_section: string | null;
  similarity?: number;
}

// Types for conversations
export interface SourceInfo {
  id: string;
  title: string;
  url: string;
  type: string;
  icon: string;
  section: string | null;
}

export interface AttachmentInfo {
  type: 'text' | 'pdf';
  name: string;
  preview: string;
  fullContent?: string;
}

export interface ConversationMessage {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant';
  content: string;
  sources?: SourceInfo[];
  attachment?: AttachmentInfo;
  created_at: string;
}

export interface Conversation {
  id: string;
  user_email: string;
  title: string;
  created_at: string;
  updated_at: string;
  messages?: ConversationMessage[];
}

// Lazy initialization to avoid build-time errors
let _supabaseClient: SupabaseClient | null = null;
let _supabaseAdmin: SupabaseClient | null = null;

// Client-side Supabase client (uses publishable key)
export function getSupabaseClient(): SupabaseClient {
  if (!_supabaseClient) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY;

    if (!url || !publishableKey) {
      throw new Error('Missing Supabase environment variables');
    }

    _supabaseClient = createClient(url, publishableKey);
  }
  return _supabaseClient;
}

// Server-side Supabase client (uses service role key for RPC calls)
export function getSupabaseAdmin(): SupabaseClient {
  if (!_supabaseAdmin) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !serviceKey) {
      throw new Error('Missing Supabase environment variables');
    }

    _supabaseAdmin = createClient(url, serviceKey);
  }
  return _supabaseAdmin;
}

// Function to search knowledge chunks using pgvector
export async function searchKnowledgeChunks(
  queryEmbedding: number[],
  threshold: number = 0.7,
  count: number = 5
): Promise<KnowledgeChunk[]> {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase.rpc('match_knowledge_chunks', {
    query_embedding: queryEmbedding,
    threshold,
    count,
  });

  if (error) {
    console.error('Error searching knowledge chunks:', error);
    throw new Error(`Failed to search knowledge base: ${error.message}`);
  }

  return data as KnowledgeChunk[];
}

// ============================================
// Conversation Management Functions
// ============================================

/**
 * Create a new conversation
 */
export async function createConversation(
  userEmail: string,
  title: string = 'New Conversation'
): Promise<Conversation> {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from('conversations')
    .insert({ user_email: userEmail, title })
    .select()
    .single();

  if (error) {
    console.error('Error creating conversation:', error);
    throw new Error(`Failed to create conversation: ${error.message}`);
  }

  return data as Conversation;
}

/**
 * Get all conversations for a user
 */
export async function getConversations(userEmail: string): Promise<Conversation[]> {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from('conversations')
    .select('*')
    .eq('user_email', userEmail)
    .order('updated_at', { ascending: false });

  if (error) {
    console.error('Error fetching conversations:', error);
    throw new Error(`Failed to fetch conversations: ${error.message}`);
  }

  return data as Conversation[];
}

/**
 * Get a single conversation with its messages
 */
export async function getConversationWithMessages(
  conversationId: string,
  userEmail: string
): Promise<Conversation | null> {
  const supabase = getSupabaseAdmin();

  // First get the conversation
  const { data: conversation, error: convError } = await supabase
    .from('conversations')
    .select('*')
    .eq('id', conversationId)
    .eq('user_email', userEmail)
    .single();

  if (convError) {
    if (convError.code === 'PGRST116') {
      return null; // Not found
    }
    console.error('Error fetching conversation:', convError);
    throw new Error(`Failed to fetch conversation: ${convError.message}`);
  }

  // Then get the messages
  const { data: messages, error: msgError } = await supabase
    .from('conversation_messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true });

  if (msgError) {
    console.error('Error fetching messages:', msgError);
    throw new Error(`Failed to fetch messages: ${msgError.message}`);
  }

  return {
    ...conversation,
    messages: messages as ConversationMessage[],
  } as Conversation;
}

/**
 * Add a message to a conversation
 */
export async function addMessage(
  conversationId: string,
  role: 'user' | 'assistant',
  content: string,
  sources?: SourceInfo[],
  attachment?: AttachmentInfo
): Promise<ConversationMessage> {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from('conversation_messages')
    .insert({
      conversation_id: conversationId,
      role,
      content,
      sources: sources || null,
      attachment: attachment || null,
    })
    .select()
    .single();

  if (error) {
    console.error('Error adding message:', error);
    throw new Error(`Failed to add message: ${error.message}`);
  }

  return data as ConversationMessage;
}

/**
 * Update conversation title
 */
export async function updateConversationTitle(
  conversationId: string,
  title: string
): Promise<void> {
  const supabase = getSupabaseAdmin();

  const { error } = await supabase
    .from('conversations')
    .update({ title })
    .eq('id', conversationId);

  if (error) {
    console.error('Error updating conversation title:', error);
    throw new Error(`Failed to update title: ${error.message}`);
  }
}

/**
 * Delete a conversation and all its messages
 */
export async function deleteConversation(
  conversationId: string,
  userEmail: string
): Promise<void> {
  const supabase = getSupabaseAdmin();

  const { error } = await supabase
    .from('conversations')
    .delete()
    .eq('id', conversationId)
    .eq('user_email', userEmail);

  if (error) {
    console.error('Error deleting conversation:', error);
    throw new Error(`Failed to delete conversation: ${error.message}`);
  }
}
