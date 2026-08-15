-- ==============================================================================
-- PostgreSQL initialization script
-- Runs ONCE when the container is first created (docker-entrypoint-initdb.d)
--
-- Creates a separate test database so integration tests never touch the
-- development dataset.
-- ==============================================================================

-- Create the test database (the main DB is created by POSTGRES_DB env var)
SELECT 'CREATE DATABASE incident_management_test OWNER incident_user'
WHERE NOT EXISTS (
  SELECT FROM pg_database WHERE datname = 'incident_management_test'
)\gexec

-- Enable the uuid-ossp extension on both databases so UUID generation works
\c incident_management
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- powers fast full-text LIKE searches

\c incident_management_test
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
