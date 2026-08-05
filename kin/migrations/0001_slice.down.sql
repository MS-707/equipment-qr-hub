-- ============================================================================
-- 0001_slice.down.sql — KIN-M0-T3: fully reverses 0001_slice.up.sql.
--
-- Drops the four slice tables and their indexes, children before parents so
-- foreign keys never block a drop:
--   signatures, inspection_items  (children of inspection_records)
--   inspection_records            (child of equipment)
--   equipment                     (parent, last)
--
-- In SQLite, DROP TABLE also drops the table's indexes, but the explicit
-- DROP INDEX statements below make the reversal self-documenting and remain
-- safe (IF EXISTS) whichever order a runner executes them in.
-- After this file runs against a database that had only 0001 applied, zero
-- app tables remain.
-- ============================================================================

DROP INDEX IF EXISTS idx_inspection_records_sheet_unsynced;
DROP INDEX IF EXISTS idx_inspection_records_created_at;
DROP INDEX IF EXISTS idx_inspection_records_kin_user_id;
DROP INDEX IF EXISTS idx_inspection_records_equipment_id;

DROP TABLE IF EXISTS signatures;
DROP TABLE IF EXISTS inspection_items;
DROP TABLE IF EXISTS inspection_records;
DROP TABLE IF EXISTS equipment;
