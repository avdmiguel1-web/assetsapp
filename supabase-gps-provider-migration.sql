-- Add gps_provider column to assets table
-- Run this in Supabase SQL Editor
ALTER TABLE assets ADD COLUMN IF NOT EXISTS gps_provider TEXT DEFAULT 'flespi';
