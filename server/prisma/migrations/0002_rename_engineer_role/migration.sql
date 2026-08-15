-- =============================================================================
-- Migration: 0002_rename_engineer_role
-- Description: Rename UserRole enum value ENGINEER → SUPPORT_ENGINEER to match
--              the RBAC specification. This requires:
--              1. Adding the new enum value to the existing Postgres type.
--              2. Updating all rows that currently hold 'ENGINEER'.
--              3. Updating the DEFAULT constraint on users.role.
--              4. Removing the old enum value (Postgres ALTER TYPE DROP VALUE
--                 is only permitted when no rows reference the old value and
--                 there are no DEFAULT expressions using it).
--
-- Note: Postgres does not support DROP VALUE on an enum that is still in use
-- or referenced by a DEFAULT. We therefore:
--   a. Create the new enum type under a temporary name.
--   b. Alter each column to use the new type (with USING cast).
--   c. Drop the old type.
--   d. Rename the new type to the original name.
-- =============================================================================

-- Step 1: Create the replacement enum type with the corrected value set.
CREATE TYPE "UserRole_new" AS ENUM (
  'ADMIN',
  'MANAGER',
  'SUPPORT_ENGINEER',
  'VIEWER'
);

-- Step 2: Migrate the users.role column to the new type.
--   - Default must be dropped before ALTER COLUMN TYPE so Postgres can
--     re-evaluate the expression against the new type.
ALTER TABLE "users"
  ALTER COLUMN "role" DROP DEFAULT;

ALTER TABLE "users"
  ALTER COLUMN "role" TYPE "UserRole_new"
  USING (
    CASE "role"::text
      WHEN 'ENGINEER' THEN 'SUPPORT_ENGINEER'::"UserRole_new"
      ELSE "role"::text::"UserRole_new"
    END
  );

ALTER TABLE "users"
  ALTER COLUMN "role" SET DEFAULT 'SUPPORT_ENGINEER'::"UserRole_new";

-- Step 3: Migrate the roles.name column (reference table) to the new type.
ALTER TABLE "roles"
  ALTER COLUMN "name" TYPE "UserRole_new"
  USING (
    CASE "name"::text
      WHEN 'ENGINEER' THEN 'SUPPORT_ENGINEER'::"UserRole_new"
      ELSE "name"::text::"UserRole_new"
    END
  );

-- Step 4: Drop the old enum type and rename the new one.
DROP TYPE "UserRole";
ALTER TYPE "UserRole_new" RENAME TO "UserRole";

-- Step 5: Update the roles reference-table seed row so the label matches.
UPDATE "roles"
SET "name" = 'SUPPORT_ENGINEER'
WHERE "name"::text = 'ENGINEER';
