-- Migration: YYYYMMDDHHMMSS_description
-- Created: {{DATE}}
-- Author: MatchMap Team

-- ==================================================
-- 1. CREATE TABLES
-- ==================================================

CREATE TABLE IF NOT EXISTS support_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  bar_id uuid REFERENCES bars(id) ON DELETE SET NULL,
  subject text NOT NULL,
  message text NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
  priority text NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- ==================================================
-- 2. CREATE INDEXES
-- ==================================================

CREATE INDEX idx_support_tickets_user_id ON support_tickets(user_id);
CREATE INDEX idx_support_tickets_status ON support_tickets(status);
CREATE INDEX idx_support_tickets_created_at ON support_tickets(created_at DESC);

-- ==================================================
-- 3. ENABLE RLS
-- ==================================================

ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;

-- ==================================================
-- 4. CREATE RLS POLICIES
-- ==================================================

-- Users can view their own tickets
CREATE POLICY "Users can view own tickets"
  ON support_tickets
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Users can create tickets
CREATE POLICY "Users can create tickets"
  ON support_tickets
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own tickets (only message)
CREATE POLICY "Users can update own tickets"
  ON support_tickets
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Admin users can see all tickets (implement based on your admin logic)
-- CREATE POLICY "Admins can view all tickets"
--   ON support_tickets
--   FOR ALL
--   TO authenticated
--   USING (
--     EXISTS (
--       SELECT 1 FROM users
--       WHERE users.id = auth.uid()
--       AND users.is_admin = true
--     )
--   );

-- ==================================================
-- 5. CREATE FUNCTIONS/TRIGGERS
-- ==================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for support_tickets
CREATE TRIGGER update_support_tickets_updated_at
  BEFORE UPDATE ON support_tickets
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ==================================================
-- 6. GRANTS (si es necesario)
-- ==================================================

GRANT SELECT, INSERT, UPDATE ON support_tickets TO authenticated;
GRANT SELECT, INSERT, UPDATE ON support_tickets TO anon;

-- ==================================================
-- 7. ROLLBACK (comentado, para referencia)
-- ==================================================

/*
DROP TRIGGER IF EXISTS update_support_tickets_updated_at ON support_tickets;
DROP FUNCTION IF EXISTS update_updated_at_column();
DROP POLICY IF EXISTS "Users can view own tickets" ON support_tickets;
DROP POLICY IF EXISTS "Users can create tickets" ON support_tickets;
DROP POLICY IF EXISTS "Users can update own tickets" ON support_tickets;
DROP TABLE IF EXISTS support_tickets;
*/
