-- Add normalized_value column to data_points.
-- Stores the AI-produced canonical form of value for cross-competitor display.
-- NULL until normalization runs; UI falls back to the raw value column.

alter table data_points add column normalized_value text;

comment on column data_points.normalized_value is
  'AI-produced canonical form of value for cross-competitor display. NULL until normalization runs.';
