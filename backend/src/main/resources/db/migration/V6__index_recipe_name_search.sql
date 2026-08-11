CREATE INDEX idx_recipes_name_trgm
    ON recipes USING gin (lower(name) gin_trgm_ops);
