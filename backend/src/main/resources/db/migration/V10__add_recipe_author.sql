INSERT INTO app_users (display_name, email, password_hash, role, enabled)
VALUES (
    'Catálogo EuChef',
    'catalogo@euchef.local',
    '$2a$10$012345678901234567890u012345678901234567890123456789012',
    'USER',
    FALSE
);

ALTER TABLE recipes
    ADD COLUMN author_id BIGINT;

UPDATE recipes
SET author_id = (SELECT id FROM app_users WHERE email = 'catalogo@euchef.local')
WHERE author_id IS NULL;

ALTER TABLE recipes
    ALTER COLUMN author_id SET NOT NULL,
    ADD CONSTRAINT fk_recipes_author
        FOREIGN KEY (author_id) REFERENCES app_users(id) ON DELETE RESTRICT;

CREATE INDEX ix_recipes_author_id ON recipes (author_id);