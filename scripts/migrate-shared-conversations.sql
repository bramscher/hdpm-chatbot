-- Migration: Shared Team Conversations
-- Adds user attribution fields so conversations can be shared across team members
-- Run this in Supabase SQL Editor

-- 1. Add creator name to conversations table
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS user_name TEXT;

-- 2. Add sender info to conversation_messages table
ALTER TABLE conversation_messages ADD COLUMN IF NOT EXISTS sender_name TEXT;
ALTER TABLE conversation_messages ADD COLUMN IF NOT EXISTS sender_email TEXT;

-- 3. Backfill existing conversations with name derived from email
UPDATE conversations
SET user_name = INITCAP(REPLACE(SPLIT_PART(user_email, '@', 1), '.', ' '))
WHERE user_name IS NULL;

-- 4. Backfill existing messages with sender info from parent conversation
UPDATE conversation_messages cm
SET
  sender_email = c.user_email,
  sender_name = COALESCE(c.user_name, INITCAP(REPLACE(SPLIT_PART(c.user_email, '@', 1), '.', ' ')))
FROM conversations c
WHERE cm.conversation_id = c.id
  AND cm.role = 'user'
  AND cm.sender_email IS NULL;

-- 5. Set AI assistant name for assistant messages
UPDATE conversation_messages
SET sender_name = 'AI Assistant'
WHERE role = 'assistant'
  AND sender_name IS NULL;
