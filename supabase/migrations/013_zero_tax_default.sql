-- ============================================================================
-- Migration: 013_zero_tax_default.sql
-- Description: Default tax_rate to 0% for new restaurants, and reset
-- existing restaurants to 0% (mirrors 009_fiscal_invoices.sql's reverse
-- move, which set the default to 7% ITBMS).
-- ============================================================================

ALTER TABLE restaurants ALTER COLUMN tax_rate SET DEFAULT 0.0000;

UPDATE restaurants SET tax_rate = 0.0000;
