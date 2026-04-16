-- Messaging system — Investigator ↔ Founder
-- Apply via Neon SQL Editor (ep-square-band). Additive only. Safe to re-run.

CREATE TABLE IF NOT EXISTS "Conversation" (
  "id" TEXT NOT NULL,
  "scopeType" TEXT NOT NULL DEFAULT 'direct',
  "scopeId" TEXT,
  "status" TEXT NOT NULL DEFAULT 'open',
  "lastMessageAt" TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "Conversation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ConversationParticipant" (
  "id" TEXT NOT NULL,
  "conversationId" TEXT NOT NULL,
  "accessId" TEXT NOT NULL,
  "joinedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "lastReadAt" TIMESTAMPTZ,
  CONSTRAINT "ConversationParticipant_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ConversationParticipant_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "ConversationParticipant_conversationId_accessId_key" ON "ConversationParticipant"("conversationId", "accessId");
CREATE INDEX IF NOT EXISTS "ConversationParticipant_accessId_idx" ON "ConversationParticipant"("accessId");

CREATE TABLE IF NOT EXISTS "Message" (
  "id" TEXT NOT NULL,
  "conversationId" TEXT NOT NULL,
  "senderAccessId" TEXT NOT NULL,
  "senderName" TEXT NOT NULL,
  "senderEmail" TEXT,
  "kind" TEXT NOT NULL DEFAULT 'message',
  "body" TEXT NOT NULL,
  "priority" TEXT NOT NULL DEFAULT 'normal',
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "Message_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Message_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "Message_conversationId_idx" ON "Message"("conversationId");
CREATE INDEX IF NOT EXISTS "Message_senderAccessId_idx" ON "Message"("senderAccessId");

CREATE TABLE IF NOT EXISTS "MessageRead" (
  "id" TEXT NOT NULL,
  "messageId" TEXT NOT NULL,
  "accessId" TEXT NOT NULL,
  "readAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "MessageRead_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "MessageRead_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "MessageRead_messageId_accessId_key" ON "MessageRead"("messageId", "accessId");

CREATE TABLE IF NOT EXISTS "FeedbackEntry" (
  "id" TEXT NOT NULL,
  "accessId" TEXT NOT NULL,
  "investigatorName" TEXT NOT NULL,
  "investigatorEmail" TEXT,
  "workspaceId" TEXT,
  "type" TEXT NOT NULL DEFAULT 'feedback',
  "body" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'unread',
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "FeedbackEntry_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "FeedbackEntry_accessId_idx" ON "FeedbackEntry"("accessId");
CREATE INDEX IF NOT EXISTS "FeedbackEntry_status_idx" ON "FeedbackEntry"("status");
