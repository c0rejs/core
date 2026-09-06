import sql from "#lib/sql";

export default sql`

CREATE OR REPLACE FUNCTION user_after_update_trigger() RETURNS TRIGGER AS $$
DECLARE
    v_data jsonb;
BEGIN

    IF OLD.enabled != NEW.enabled THEN
        data:= ( SELECT jsonb_set_lax( coalesce( v_data, '{}' ), '{enabled}', to_jsonb( NEW.enabled ), TRUE, 'use_json_null' ) );
    END IF;

    IF OLD.locale != NEW.locale THEN
        data:= ( SELECT jsonb_set_lax( coalesce( v_data, '{}' ), '{locale}', to_jsonb( NEW.locale ), TRUE, 'use_json_null' ) );
    END IF;

    IF OLD.email != NEW.email THEN
        data:= ( SELECT jsonb_set_lax( coalesce( v_data, '{}' ), '{email}', to_jsonb( NEW.email ), TRUE, 'use_json_null' ) );
    END IF;

    IF OLD.email_confirmed != NEW.email_confirmed THEN
        data:= ( SELECT jsonb_set_lax( coalesce( v_data, '{}' ), '{email_confirmed}', to_jsonb( NEW.email_confirmed ), TRUE, 'use_json_null' ) );
    END IF;

    IF v_data IS NOT NULL THEN
        data:= ( SELECT jsonb_set( v_data, '{id}', to_jsonb( NEW.id ), TRUE ) );

       PERFORM pg_notify( 'users/user/update', data::text );
    END IF;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

`;
