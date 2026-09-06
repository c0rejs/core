import sql from "#lib/sql";

export default sql`

CREATE TABLE notification (
    id serial4 PRIMARY KEY,
    name text NOT NULL UNIQUE
);

CREATE TABLE user_notification (
    user_id int53 NOT NULL REFERENCES "user" ( id ) ON DELETE CASCADE,
    notification_id int4 NOT NULL REFERENCES notification ( id ) ON DELETE RESTRICT,
    internal bool,
    email bool,
    telegram bool,
    push bool,
    PRIMARY KEY ( user_id, notification_id )
);

CREATE FUNCTION get_notification_id ( p_name text ) RETURNS int4 AS $$
DECLARE
    v_id int4;
BEGIN

    SELECT id FROM notification WHERE name = p_name INTO v_id;

    IF v_id IS NULL THEN
        INSERT INTO notification ( name ) VALUES ( p_name ) RETURNING id INTO v_id;
    END IF;

    RETURN v_id;
END;
$$ LANGUAGE plpgsql;

CREATE FUNCTION get_user_notifications ( p_user_id int53 ) RETURNS json AS $$
BEGIN

    RETURN (
        SELECT json_object_agg( notification.name, json_build_object(
            'internal', internal,
            'email', email,
            'telegram', telegram,
            'push', push
    ) ) FROM
            user_notification,
            notification
        WHERE
            user_notification.user_id = p_user_id
            AND user_notification.notification_id = notification.id
);

END;
$$ LANGUAGE plpgsql;

CREATE FUNCTION user_notification_trigger () RETURNS TRIGGER AS $$
DECLARE
    v_user_id int53;
BEGIN

    -- delete
    IF TG_OP = 'DELETE' THEN

        -- user was deleted
        IF NOT EXISTS ( SELECT FROM "user" WHERE id = OLD.user_id ) THEN
            RETURN NULL;
        END IF;

        v_user_id := OLD.user_id;
    ELSE
        v_user_id := NEW.user_id;
    END IF;

    PERFORM pg_notify( 'users/user-notification/update', json_build_object(
        'id', v_user_id,
        'notifications', get_user_notifications( v_user_id )
    )::text );

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER user_notification_after_update AFTER INSERT OR UPDATE OR DELETE ON user_notification FOR EACH ROW EXECUTE FUNCTION user_notification_trigger();

`;
