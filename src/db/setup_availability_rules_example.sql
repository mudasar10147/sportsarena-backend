-- Example: Set up availability rules for Court 1
-- This creates rules for all days of the week

-- Monday to Friday: 9 AM to 6 PM (540 = 09:00, 1080 = 18:00)
INSERT INTO court_availability_rules (court_id, day_of_week, start_time, end_time, is_active)
VALUES 
  (1, 1, 540, 1080, true),  -- Monday: 09:00-18:00
  (1, 2, 540, 1080, true),  -- Tuesday: 09:00-18:00
  (1, 3, 540, 1080, true),  -- Wednesday: 09:00-18:00
  (1, 4, 540, 1080, true),  -- Thursday: 09:00-18:00
  (1, 5, 540, 1080, true)   -- Friday: 09:00-18:00
ON CONFLICT (court_id, day_of_week, start_time, end_time) DO NOTHING;

-- Weekend: 10 AM to 8 PM (600 = 10:00, 1200 = 20:00)
INSERT INTO court_availability_rules (court_id, day_of_week, start_time, end_time, is_active)
VALUES 
  (1, 6, 600, 1200, true),  -- Saturday: 10:00-20:00
  (1, 0, 600, 1200, true)   -- Sunday: 10:00-20:00
ON CONFLICT (court_id, day_of_week, start_time, end_time) DO NOTHING;

-- Verify rules were created
SELECT 
  id,
  court_id,
  CASE day_of_week
    WHEN 0 THEN 'Sunday'
    WHEN 1 THEN 'Monday'
    WHEN 2 THEN 'Tuesday'
    WHEN 3 THEN 'Wednesday'
    WHEN 4 THEN 'Thursday'
    WHEN 5 THEN 'Friday'
    WHEN 6 THEN 'Saturday'
  END as day_name,
  LPAD((start_time / 60)::text, 2, '0') || ':' || LPAD((start_time % 60)::text, 2, '0') as start_time_formatted,
  LPAD((end_time / 60)::text, 2, '0') || ':' || LPAD((end_time % 60)::text, 2, '0') as end_time_formatted,
  is_active
FROM court_availability_rules
WHERE court_id = 1
ORDER BY day_of_week, start_time;




