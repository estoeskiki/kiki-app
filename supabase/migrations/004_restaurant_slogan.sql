-- Add slogan column to organizations table
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS slogan text DEFAULT '';
