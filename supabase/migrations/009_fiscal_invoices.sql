-- ============================================================================
-- Migration: 009_fiscal_invoices.sql
-- Description: Add fields to support Panama DGI fiscal e-invoicing.
-- ============================================================================

-- 1. Add API token to restaurants
ALTER TABLE restaurants 
ADD COLUMN fiscal_api_token text;

-- 2. Add fiscal tracking fields to sub_orders
ALTER TABLE sub_orders
ADD COLUMN fiscal_invoice_id uuid,
ADD COLUMN fiscal_cufe text,
ADD COLUMN fiscal_protocol text,
ADD COLUMN fiscal_qr_content text,
ADD COLUMN fiscal_xml text;

-- 3. Add array of invoice IDs to parent orders for quick reference
ALTER TABLE orders
ADD COLUMN fiscal_invoice_ids uuid[] DEFAULT '{}';

-- 4. Update the default tax rate on existing restaurants to 7% (0.0700) 
-- Note: Panama ITBMS is 7%
ALTER TABLE restaurants
ALTER COLUMN tax_rate SET DEFAULT 0.0700;

UPDATE restaurants 
SET tax_rate = 0.0700;
