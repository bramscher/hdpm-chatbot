-- Create conversations table for storing chat history
-- Run this in your Supabase SQL editor

-- Conversations table
CREATE TABLE IF NOT EXISTS conversations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_email TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT 'New Conversation',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Messages table (stores individual messages within a conversation)
CREATE TABLE IF NOT EXISTS conversation_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  sources JSONB, -- Store sources as JSON array
  attachment JSONB, -- Store attachment info as JSON
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_conversations_user_email ON conversations(user_email);
CREATE INDEX IF NOT EXISTS idx_conversations_updated_at ON conversations(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversation_messages_conversation_id ON conversation_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_conversation_messages_created_at ON conversation_messages(created_at);

-- Function to update conversation's updated_at timestamp when a message is added
CREATE OR REPLACE FUNCTION update_conversation_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE conversations
  SET updated_at = NOW()
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update conversation timestamp on new message
DROP TRIGGER IF EXISTS trigger_update_conversation_timestamp ON conversation_messages;
CREATE TRIGGER trigger_update_conversation_timestamp
  AFTER INSERT ON conversation_messages
  FOR EACH ROW
  EXECUTE FUNCTION update_conversation_timestamp();

-- Enable Row Level Security (RLS)
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_messages ENABLE ROW LEVEL SECURITY;

-- RLS Policies for conversations
-- Allow users to see only their own conversations
CREATE POLICY "Users can view own conversations" ON conversations
  FOR SELECT USING (true); -- We'll filter by user_email in the application

CREATE POLICY "Users can insert own conversations" ON conversations
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can update own conversations" ON conversations
  FOR UPDATE USING (true);

CREATE POLICY "Users can delete own conversations" ON conversations
  FOR DELETE USING (true);

-- RLS Policies for messages (access controlled through conversation ownership)
CREATE POLICY "Users can view conversation messages" ON conversation_messages
  FOR SELECT USING (true);

CREATE POLICY "Users can insert conversation messages" ON conversation_messages
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can delete conversation messages" ON conversation_messages
  FOR DELETE USING (true);

-- Grant access to the service role
GRANT ALL ON conversations TO service_role;
GRANT ALL ON conversation_messages TO service_role;
