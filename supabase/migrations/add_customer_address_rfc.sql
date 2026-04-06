-- Add RFC and delivery address fields to customers table
ALTER TABLE customers
  ADD COLUMN rfc TEXT,
  ADD COLUMN delivery_address TEXT;
