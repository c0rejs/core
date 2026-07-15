import * as yaml from "js-yaml";
import ejs from "#lib/ejs";
import Locale from "#lib/locale";

const SCHEMAS = {};

// public
export function toYaml ( data, { yaml11, locale, ejs, indent, lineWidth, readable = true, flowLevel, sortKeys, seqNoIndent, seqInlineFirst, noRefs } = {} ) {
    return yaml.dump( data, {
        "indent": indent || 2,
        "lineWidth": lineWidth || -1,
        "flowLevel": flowLevel ?? -1,
        "flowBracketPadding": !!readable,
        "flowSkipCommaSpace": !readable,
        "flowSkipColonSpace": !readable,
        "sortKeys": sortKeys ?? false,
        "seqNoIndent": seqNoIndent ?? false,
        "seqInlineFirst": seqInlineFirst ?? true,
        "quoteStyle": "double",
        "forceQuotes": false,
        "quoteFlowKeys": false,
        "noRefs": noRefs ?? false,
        "tagBeforeAnchor": false,
        "schema": buildSchema( yaml11, locale, ejs ),
    } );
}

export function fromYaml ( buffer, { yaml11, locale, ejs, all } = {} ) {
    const config = yaml.loadAll( buffer, {
        "schema": buildSchema( yaml11, locale, ejs ),
    } );

    if ( all ) {
        return config;
    }
    else {
        return config[ 0 ];
    }
}

// private
function buildSchema ( yaml11, locale, ejsConstructor ) {
    locale ||= Locale.default;
    ejsConstructor ||= ejs;

    var cacheId, schema;

    if ( locale === Locale.default && ejsConstructor === ejs ) {
        cacheId = yaml11
            ? "yaml11"
            : "core";

        schema = SCHEMAS[ cacheId ];

        if ( schema ) return schema;
    }

    const baseSchema = yaml11
        ? yaml.YAML11_SCHEMA
        : yaml.CORE_SCHEMA;

    schema = baseSchema.withTags(

        // null
        {
            ...yaml.nullCoreTag,
            "represent": () => "~",
        },

        // l10n
        yaml.defineScalarTag( "!l10n", {
            resolve ( data ) {
                if ( !data || typeof data !== "string" ) {
                    return yaml.NOT_RESOLVED;
                }
                else {
                    return locale.l10n( data );
                }
            },
        } ),

        yaml.defineSequenceTag( "!l10n", {
            create ( tagName ) {
                return [];
            },

            addItem ( container, item ) {
                container.push( item );
            },

            finalize ( container ) {
                if ( !container[ 0 ] || typeof container[ 0 ] !== "string" ) throw new Error( "!l10n params are not valid" );

                if ( container[ 1 ] !== undefined && typeof container[ 1 ] !== "string" ) throw new Error( "!l10n params are not valid" );

                if ( container[ 2 ] !== undefined && typeof container[ 2 ] !== "number" ) throw new Error( "!l10n params are not valid" );

                return locale.l10n( ...container );
            },
        } ),

        // l10nt
        yaml.defineScalarTag( "!l10nt", {
            resolve ( data ) {
                return locale.l10nt( data );
            },
        } ),

        yaml.defineSequenceTag( "!l10nt", {
            create ( tagName ) {
                return [];
            },

            addItem ( container, item ) {
                container.push( item );
            },

            finalize ( container ) {
                return locale.l10nt( ...container );
            },
        } ),

        // ejs
        yaml.defineScalarTag( "!ejs", {
            resolve ( data ) {
                if ( !data || typeof data !== "string" ) {
                    return yaml.NOT_RESOLVED;
                }
                else {
                    return ejsConstructor( data );
                }
            },
        } )
    );

    // cache schema
    if ( cacheId ) {
        SCHEMAS[ cacheId ] = schema;
    }

    return schema;
}
