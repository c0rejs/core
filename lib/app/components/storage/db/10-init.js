import sql from "#lib/sql";

export default sql`

CREATE EXTENSION IF NOT EXISTS softvisio_types;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE SEQUENCE storage_image_id_seq AS int8 MAXVALUE ${ Number.MAX_SAFE_INTEGER };

CREATE TABLE storage_image (
    id int53 PRIMARY KEY DEFAULT nextval( 'storage_image_id_seq' ),
    path text NOT NULL UNIQUE,
    oid oid UNIQUE,
    hash text NOT NULL,
    size int53 NOT NULL,
    encrypted boolean NOT NULL,
    links_count int53 NOT NULL DEFAULT 0
);

ALTER SEQUENCE storage_image_id_seq OWNED BY storage_image.id;

CREATE SEQUENCE storage_file_id_seq AS int8 MAXVALUE ${ Number.MAX_SAFE_INTEGER };

CREATE TABLE storage_file (
    id int53 PRIMARY KEY DEFAULT nextval( 'storage_file_id_seq' ),
    storage_image_id int53 NOT NULL REFERENCES storage_image ( id ) ON DELETE RESTRICT,
    path text NOT NULL UNIQUE,
    created timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_modified timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    content_type text,
    cache_control text,
    content_disposition text,
    inactive_max_age text,
    expires timestamptz
);

ALTER SEQUENCE storage_file_id_seq OWNED BY storage_file.id;

CREATE INDEX storage_file_expires_idx ON storage_file ( expires );

-- trigram index is required for pattern search
CREATE INDEX storage_file_path_trigram_idx ON storage_file USING gin ( path gin_trgm_ops );

CREATE FUNCTION storage_create_image (
    p_path text,
    p_hash text,
    p_size int53,
    p_encrypted bool
) RETURNS int53 AS $$
DECLARE
    v_id int53;
BEGIN

    IF NOT EXISTS ( SELECT FROM storage_image WHERE path = p_path ) THEN
        INSERT INTO storage_image
        (
            path,
            hash,
            size,
            encrypted
        )
        VALUES (
            p_path,
            p_hash,
            p_size,
            p_encrypted
        )
        RETURNING
            id
        INTO
            v_id;
    ELSE
        UPDATE
            storage_image
        SET
            hash = p_hash,
            size = p_size,
            encrypted = p_encrypted
        WHERE
            path = p_path
        RETURNING
            id
        INTO
            v_id;
    END IF;

    RETURN v_id;
END;
$$ LANGUAGE plpgsql;

CREATE FUNCTION storage_create_file (
    p_storage_image_id int53,
    p_path text,
    p_last_modified timestamptz,
    p_content_type text,
    p_cache_control text,
    p_content_disposition text,
    p_inactive_max_age text,
    p_expires timestamptz
) RETURNS int53 AS $$
DECLARE
    v_id int53;
BEGIN

    IF NOT EXISTS ( SELECT FROM storage_file WHERE path = p_path ) THEN
        INSERT INTO storage_file
        (
            storage_image_id,
            path,
            last_modified,
            content_type,
            cache_control,
            content_disposition,
            inactive_max_age,
            expires
        )
        VALUES (
            p_storage_image_id,
            p_path,
            coalesce( p_last_modified, CURRENT_TIMESTAMP ),
            p_content_type,
            p_cache_control,
            p_content_disposition,
            p_inactive_max_age,
            p_expires
        )
        RETURNING
            id
        INTO
            v_id;
    ELSE
        UPDATE
            storage_file
        SET
            storage_image_id = p_storage_image_id,
            last_modified = coalesce( p_last_modified, CURRENT_TIMESTAMP ),
            content_type = p_content_type,
            cache_control = p_cache_control,
            content_disposition = p_content_disposition,
            inactive_max_age = p_inactive_max_age,
            expires = p_expires
        WHERE
            path = p_path
        RETURNING
            id
        INTO
            v_id;
    END IF;

    RETURN v_id;
END;
$$ LANGUAGE plpgsql;

CREATE FUNCTION storage_file_after_insert_trigger () RETURNS TRIGGER AS $$
BEGIN

    UPDATE storage_image SET links_count = links_count + 1 WHERE id = NEW.storage_image_id;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER storage_file_after_insert AFTER INSERT ON storage_file FOR EACH ROW EXECUTE FUNCTION storage_file_after_insert_trigger();

CREATE OR REPLACE FUNCTION storage_file_after_update_trigger () RETURNS TRIGGER AS $$
DECLARE
    V_image record;
BEGIN

    IF OLD.storage_image_id != NEW.storage_image_id THEN
        UPDATE storage_image SET links_count = links_count - 1 WHERE id = OLD.storage_image_id;

        UPDATE storage_image SET links_count = links_count + 1 WHERE id = NEW.storage_image_id;
    END IF;

    -- renamed
    IF OLD.path != NEW.path THEN
        PERFORM pg_notify( 'storage/file/delete', json_build_object(
            'id', NEW.id
        )::text );

    -- updated
    ELSE
        SELECT path, hash, size, encrypted FROM storage_image WHERE id = NEW.storage_image_id INTO v_image;

        PERFORM pg_notify( 'storage/file/update', json_build_object(
            'id', NEW.id,
            'path', NEW.path,
            'storage_image_id', NEW.storage_image_id,
            'last_modified', NEW.last_modified,
            'content_type', NEW.content_type,
            'cache_control', NEW.cache_control,
            'content_disposition', NEW.content_disposition,
            'inactive_max_age', NEW.inactive_max_age,
            'expires', NEW.expires,

            'image_path', v_image.path,
            'hash', v_image.hash,
            'size', v_image.size,
            'encrypted', v_image.encrypted
        )::text );
    END IF;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER storage_file_after_update AFTER UPDATE ON storage_file FOR EACH ROW EXECUTE FUNCTION storage_file_after_update_trigger();

CREATE FUNCTION storage_file_after_delete_trigger () RETURNS TRIGGER AS $$
BEGIN

    UPDATE storage_image SET links_count = links_count - 1 WHERE id = OLD.storage_image_id;

    PERFORM pg_notify( 'storage/file/delete', json_build_object(
        'id', OLD.id
    )::text );

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER storage_file_after_delete AFTER DELETE ON storage_file FOR EACH ROW EXECUTE FUNCTION storage_file_after_delete_trigger();

`;
