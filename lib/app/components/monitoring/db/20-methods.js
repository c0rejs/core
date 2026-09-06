import sql from "#lib/sql";

export default sql`

CREATE SEQUENCE monitoring_method_id_seq AS int8 MAXVALUE ${ Number.MAX_SAFE_INTEGER };

CREATE TABLE monitoring_method (
    id int53 PRIMARY KEY DEFAULT nextval( 'monitoring_method_id_seq' ),
    package text NOT NULL,
    component text NOT NULL,
    method text NOT NULL,
    UNIQUE ( package, component, method )
);

ALTER SEQUENCE monitoring_method_id_seq OWNED BY monitoring_method.id;

CREATE TABLE monitoring_method_stats (
    monitoring_method_id int53 NOT NULL REFERENCES monitoring_method ( id ) ON DELETE CASCADE,
    date timestamptz NOT NULL,
    calls int4 NOT NULL,
    duration number6 NOT NULL,
    exceptions int4 NOT NULL,
    UNIQUE ( monitoring_method_id, date )
);

CREATE TABLE monitoring_method_exception (
    monitoring_method_id int53 NOT NULL REFERENCES monitoring_method ( id ) ON DELETE CASCADE,
    date timestamptz NOT NULL,
    status int4 NOT NULL,
    status_text text NOT NULL,
    duration number6 NOT NULL
);

CREATE INDEX monitoring_method_exception_monitoring_method_id_date_idx ON monitoring_method_exception ( monitoring_method_id, date );

CREATE FUNCTION insert_monitoring_method ( p_package text, p_component text, p_method text ) RETURNS int53 AS $$
DECLARE
    v_id int53;
BEGIN

    SELECT id FROM monitoring_method WHERE package = p_package AND component = p_component AND method = p_method INTO v_id;

    IF v_id IS NULL THEN
        INSERT INTO monitoring_method ( package, component, method ) VALUES ( p_package, p_component, p_method ) RETURNING id INTO v_id;
    END IF;

    RETURN v_id;
END;
$$ LANGUAGE plpgsql;

`;
