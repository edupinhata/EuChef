ALTER TABLE recipes
    ADD COLUMN youtube_video_url VARCHAR(500);

ALTER TABLE recipes
    ADD CONSTRAINT ck_recipes_youtube_video_url
    CHECK (
        youtube_video_url IS NULL
        OR youtube_video_url ~ '^https://(www\.)?(youtube\.com/watch\?v=|youtu\.be/)[A-Za-z0-9_-]{11}([&#?].*)?$'
    );