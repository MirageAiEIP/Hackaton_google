-- Fix PostgreSQL permissions for samu user
-- Run this with: psql -U postgres -d samu_triage -f fix-db-permissions.sql

-- Grant all privileges on the database
GRANT ALL PRIVILEGES ON DATABASE samu_triage TO samu;

-- Connect to the database and grant schema permissions
\c samu_triage

-- Grant usage and create on schema
GRANT ALL ON SCHEMA public TO samu;
GRANT USAGE ON SCHEMA public TO samu;
GRANT CREATE ON SCHEMA public TO samu;

-- Grant all privileges on all existing tables
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO samu;

-- Grant all privileges on all existing sequences
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO samu;

-- Grant all privileges on all existing functions
GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public TO samu;

-- Set default privileges for future objects
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO samu;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO samu;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO samu;

-- Make samu the owner of the database
ALTER DATABASE samu_triage OWNER TO samu;

-- Make samu the owner of the public schema
ALTER SCHEMA public OWNER TO samu;

SELECT 'Permissions fixed successfully!' as status;
