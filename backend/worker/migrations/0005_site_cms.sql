-- Site-wide CMS document (branding, header/footer, page section text + image URLs)
CREATE TABLE IF NOT EXISTS site_cms (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  data TEXT NOT NULL DEFAULT '{}',
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT OR IGNORE INTO site_cms (id, data) VALUES (1, '{}');
