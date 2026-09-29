-- =============================================================================
-- TKG CRM - reference data that production needs too (not dev fixtures).
--
-- Pipelines are copied from the marketing site's src/config/divisions.ts as
-- of 2026-09-26 (slug, name, accent, accentInk, accentSoft - the AA-verified
-- set). The CRM never imports site code; later divisions are added from
-- /admin/pipelines.
-- =============================================================================

insert into public.stages (id, key, name, position, is_sale, is_terminal, requires_reason) values
  (1, 'new_lead',          'New Lead',          10, false, false, false),
  (2, 'contacted',         'Contacted',         20, false, false, false),
  (3, 'appointment',       'Appointment',       30, false, false, false),
  (4, 'sold',              'Sold',              40, true,  false, false),
  (5, 'documents_pending', 'Documents Pending', 50, true,  false, false),
  (6, 'installation',      'Installation',      60, true,  false, false),
  (7, 'completed',         'Completed',         70, true,  true,  false),
  (8, 'cancelled',         'Cancelled',         99, false, true,  true);

insert into public.pipelines (slug, name, accent, accent_ink, accent_soft, sort_order, is_system, allowed_stage_keys) values
  ('security-smart-home', 'Security & Smart Home', '#5A3FC0', '#4A3399', '#EDE9F9', 10, false, null),
  ('telecommunications',  'Telecommunications',    '#08718F', '#065A72', '#DEF0F6', 20, false, null),
  ('automotive',          'Automotive',            '#BC4A17', '#96380F', '#FBEBE2', 30, false, null),
  ('real-estate',         'Real Estate',           '#1F5CA8', '#1B4C8A', '#E6EDF7', 40, false, null),
  ('moving-delivery',     'Moving & Delivery',     '#9A6206', '#7C4E05', '#FAEFD9', 50, false, null),
  ('cleaning',            'Cleaning',              '#07786A', '#065E53', '#DFF2EF', 60, false, null),
  ('staffing',            'Staffing',              '#8A4BB0', '#6F3B8F', '#F1E8F7', 70, false, null),
  ('business-services',   'Business Services',     '#4A7A1C', '#3B6116', '#EEF4E2', 80, false, null),
  -- Unsorted inbox for general contact/quote forms (Q11): cannot reach Sold.
  ('general',             'General / Unsorted',    '#6F6960', '#55504A', '#EFECE5', 999, true,
   array['new_lead', 'contacted', 'cancelled']);

-- Every division pipeline starts with a zero rule; admin sets real values.
-- General has none: its deals cannot reach a sale stage.
insert into public.commission_rules (pipeline_id, type, flat_amount_cents, percent_bps, value_basis)
select id, 'flat', 0, 0, 'total_contract' from public.pipelines where slug <> 'general';

insert into public.org_settings (id) values (1);
