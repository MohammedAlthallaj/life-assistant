-- ============================================================
-- PERSONAL LIFE ASSISTANT — SUPABASE SCHEMA
-- Paste this entire file into Supabase SQL Editor and Run
-- ============================================================

CREATE TABLE IF NOT EXISTS app_settings (
  key   TEXT PRIMARY KEY,
  value TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS habits (
  id         UUID    DEFAULT gen_random_uuid() PRIMARY KEY,
  name       TEXT    NOT NULL,
  type       TEXT    NOT NULL CHECK (type IN ('islamic', 'regular', 'bad')),
  sort_order INT     DEFAULT 0,
  is_active  BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS daily_checkins (
  id              UUID  DEFAULT gen_random_uuid() PRIMARY KEY,
  date            DATE  UNIQUE NOT NULL,
  mood            INT   CHECK (mood BETWEEN 1 AND 5),
  journal         TEXT,
  wird_completed  BOOLEAN DEFAULT FALSE,
  quran_pages     INT     DEFAULT 0,
  current_surah   TEXT,
  current_juz     INT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS habit_logs (
  id        UUID    DEFAULT gen_random_uuid() PRIMARY KEY,
  habit_id  UUID    NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
  date      DATE    NOT NULL,
  completed BOOLEAN DEFAULT FALSE,
  UNIQUE(habit_id, date)
);

CREATE TABLE IF NOT EXISTS bad_habit_slips (
  id        UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  habit_id  UUID NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
  date      DATE NOT NULL,
  note      TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS books (
  id             UUID  DEFAULT gen_random_uuid() PRIMARY KEY,
  title          TEXT  NOT NULL,
  author         TEXT,
  current_page   INT   DEFAULT 0,
  total_pages    INT   DEFAULT 100,
  status         TEXT  DEFAULT 'reading' CHECK (status IN ('reading','finished','paused')),
  personal_notes TEXT,
  finished_at    DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS book_reading_logs (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  book_id    UUID NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  date       DATE NOT NULL,
  pages_read INT  DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS notes (
  id            UUID    DEFAULT gen_random_uuid() PRIMARY KEY,
  content       TEXT    NOT NULL,
  reminder_date TIMESTAMPTZ,
  is_reminder   BOOLEAN DEFAULT FALSE,
  completed     BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ideas (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  content    TEXT NOT NULL,
  category   TEXT DEFAULT 'General',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS links (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  url        TEXT NOT NULL,
  title      TEXT,
  notes      TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO habits (name, type, sort_order) VALUES
  ('Morning Athkar','islamic',1),('Fajr','islamic',2),('Fajr Sunnah','islamic',3),
  ('Dhuhr','islamic',4),('Dhuhr Sunnah','islamic',5),('Asr','islamic',6),
  ('Maghrib','islamic',7),('Maghrib Sunnah','islamic',8),('Evening Athkar','islamic',9),
  ('Isha','islamic',10),('Isha Sunnah','islamic',11),('Witr','islamic',12),
  ('Sport Session','regular',1),('Reading','regular',2),('Binaa Almanhaji','regular',3),
  ('Self Development (1hr)','regular',4),('Sleep before 11pm','regular',5),('Plan Tomorrow','regular',6)
ON CONFLICT DO NOTHING;

INSERT INTO app_settings (key, value) VALUES ('wird_target','100') ON CONFLICT (key) DO NOTHING;

ALTER TABLE app_settings      DISABLE ROW LEVEL SECURITY;
ALTER TABLE habits             DISABLE ROW LEVEL SECURITY;
ALTER TABLE daily_checkins     DISABLE ROW LEVEL SECURITY;
ALTER TABLE habit_logs         DISABLE ROW LEVEL SECURITY;
ALTER TABLE bad_habit_slips    DISABLE ROW LEVEL SECURITY;
ALTER TABLE books              DISABLE ROW LEVEL SECURITY;
ALTER TABLE book_reading_logs  DISABLE ROW LEVEL SECURITY;
ALTER TABLE notes              DISABLE ROW LEVEL SECURITY;
ALTER TABLE ideas              DISABLE ROW LEVEL SECURITY;
ALTER TABLE links              DISABLE ROW LEVEL SECURITY;
