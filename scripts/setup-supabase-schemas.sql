-- Create staging and production schemas in Supabase
-- Run this in the Supabase SQL Editor

-- Create staging schema
CREATE SCHEMA IF NOT EXISTS staging;

-- Create production schema
CREATE SCHEMA IF NOT EXISTS production;

-- Grant permissions to postgres user
GRANT ALL ON SCHEMA staging TO postgres;
GRANT ALL ON SCHEMA production TO postgres;

-- Set search path to include both schemas
ALTER DATABASE postgres SET search_path TO public, staging, production;

-- Verify schemas were created
SELECT schema_name FROM information_schema.schemata
WHERE schema_name IN ('staging', 'production');
