-- Add welcome background media URL to organizations
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS welcome_bg_url text DEFAULT '';
