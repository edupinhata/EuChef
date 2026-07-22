CREATE TABLE app_users (
    id BIGSERIAL PRIMARY KEY,
    display_name VARCHAR(100) NOT NULL,
    email VARCHAR(254) NOT NULL,
    password_hash VARCHAR(100) NOT NULL,
    role VARCHAR(20) NOT NULL,
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ck_app_users_role CHECK (role IN ('USER', 'ADMIN')),
    CONSTRAINT ck_app_users_email_lowercase CHECK (email = LOWER(email))
);

CREATE UNIQUE INDEX uq_app_users_email ON app_users (email);
