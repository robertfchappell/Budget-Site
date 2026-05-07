-- Adds expanded default bill and expense categories to all existing households.

DO $$
DECLARE
  hid UUID;
BEGIN
  FOR hid IN SELECT id FROM households LOOP
    INSERT INTO categories (household_id, name, kind, color, icon, is_system) VALUES
      -- Bill categories
      (hid, 'Mortgage/Rent',       'bill',    '#38bdf8', 'home',          true),
      (hid, 'Internet',            'bill',    '#34d399', 'wifi',          true),
      (hid, 'Phone',               'bill',    '#a78bfa', 'phone',         true),
      (hid, 'Car Payment',         'bill',    '#fb923c', 'car',           true),
      (hid, 'Credit Cards',        'bill',    '#f472b6', 'credit-card',   true),
      (hid, 'Streaming Services',  'bill',    '#c084fc', 'tv',            true),
      (hid, 'Childcare',           'bill',    '#f9a8d4', 'baby',          true),
      (hid, 'Medical',             'bill',    '#f87171', 'heart-pulse',   true),
      (hid, 'Taxes',               'bill',    '#94a3b8', 'landmark',      true),
      (hid, 'HOA',                 'bill',    '#6ee7b7', 'building',      true),
      (hid, 'Loans',               'bill',    '#fbbf24', 'banknote',      true),
      (hid, 'Gym',                 'bill',    '#60a5fa', 'dumbbell',      true),
      -- Expense categories
      (hid, 'Clothes',             'expense', '#f472b6', 'shirt',         true),
      (hid, 'Restaurants',         'expense', '#f97316', 'utensils',      true),
      (hid, 'Gas/Fuel',            'expense', '#fb7185', 'fuel',          true),
      (hid, 'Shopping',            'expense', '#60a5fa', 'shopping-bag',  true),
      (hid, 'Baby/Kids',           'expense', '#f9a8d4', 'baby',          true),
      (hid, 'Entertainment',       'expense', '#a78bfa', 'music',         true),
      (hid, 'Vacation/Travel',     'expense', '#34d399', 'plane',         true),
      (hid, 'Pets',                'expense', '#fbbf24', 'paw-print',     true),
      (hid, 'Medical',             'expense', '#f87171', 'heart-pulse',   true),
      (hid, 'Fitness',             'expense', '#38bdf8', 'dumbbell',      true),
      (hid, 'Electronics',         'expense', '#94a3b8', 'cpu',           true),
      (hid, 'Home Improvement',    'expense', '#6ee7b7', 'hammer',        true),
      (hid, 'Coffee/Snacks',       'expense', '#fb923c', 'coffee',        true),
      (hid, 'Miscellaneous',       'expense', '#94a3b8', 'circle-help',   true)
    ON CONFLICT (household_id, name, kind) DO NOTHING;
  END LOOP;
END $$;
