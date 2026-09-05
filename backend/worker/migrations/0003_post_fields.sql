-- Optional CMS fields for posts (backward compatible)
ALTER TABLE posts ADD COLUMN featured_image TEXT NOT NULL DEFAULT '';
ALTER TABLE posts ADD COLUMN excerpt TEXT NOT NULL DEFAULT '';
ALTER TABLE posts ADD COLUMN meta_title TEXT NOT NULL DEFAULT '';
ALTER TABLE posts ADD COLUMN meta_description TEXT NOT NULL DEFAULT '';
ALTER TABLE posts ADD COLUMN og_image TEXT NOT NULL DEFAULT '';
