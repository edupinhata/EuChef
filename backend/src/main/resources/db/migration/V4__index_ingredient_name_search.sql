CREATE INDEX idx_ingredients_name_trgm
    ON ingredients USING gin (lower(name) gin_trgm_ops);
