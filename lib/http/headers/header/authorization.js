import Header from "#lib/http/headers/header";
import { decodeValue, encodeValue } from "#lib/http/headers/utils";
import { objectIsPlain } from "#lib/utils";

const NAME = "authorization",
    SCHEMES = {
        "bearer": "Bearer",
        "basic": "Basic",
        "dogest": "Digest",
        "hoba": "HOBA",
        "mutual": "Mutual",
        "negotiate": "Negotiate",
        "vapid": "VAPID",
        "scram": "SCRAM",
        "aws4-hmac-sha256": "AWS4-HMAC-SHA256",
    };

export default class AuthorizationHeader extends Header {

    // static
    static get headerName () {
        return NAME;
    }

    // properties
    get scheme () {
        return this._getField( "scheme" );
    }

    get token () {
        return this._getField( "token" );
    }

    get credentials () {
        return this._getField( "credentials" );
    }

    get realm () {
        return this._getField( "realm" );
    }

    get service () {
        return this._getField( "service" );
    }

    get algorithm () {
        return this._getField( "algorithm" );
    }

    get nonce () {
        return this._getField( "nonce" );
    }

    get opaque () {
        return this._getField( "opaque" );
    }

    get qop () {
        return this._getField( "qop" );
    }

    get uri () {
        return this._getField( "uri" );
    }

    get scope () {
        return this._getField( "scope" );
    }

    // protected
    _encodeValue ( value, { encode, quote } = {} ) {
        if ( objectIsPlain( value ) ) {
            return this._build( value );
        }
        else {
            return super._encodeValue( value, { encode, quote } );
        }
    }

    // parse basic
    _parse ( value, parser ) {
        const fields = {};

        const match = value.match( /^(?<scheme>[\w-]+)\s+/ );
        if ( !match ) return;

        fields.scheme = match.groups.scheme.toLowerCase();

        value = value.slice( match[ 0 ].length ).trim();

        if ( fields.scheme === "bearer" ) {
            fields.token = value;
        }
        else if ( fields.scheme === "basic" ) {
            value = Buffer.from( value, "base64" );

            const idx = value.indexOf( ":" );

            fields.credentials = {
                "username": value.slice( 0, idx ),
                "password": value.slice( idx + 1 ),
            };
        }
        else {
            const data = parser.parseDictionary( value, { "bare": true } );
            if ( !data ) return;

            for ( const [ key, item ] of Object.entries( data ) ) {
                fields[ key ] = decodeValue( item.value, {
                    "unquote": true,
                    "decode": true,
                } );
            }
        }

        return fields;
    }

    _build ( fields ) {
        if ( !fields.scheme ) {
            return;
        }
        else {
            const scheme = fields.scheme.toLowerCase(),
                schemeName = SCHEMES[ scheme ] || scheme;

            if ( scheme === "bearer" ) {
                if ( !fields.token ) return;

                return `${ schemeName } ${ fields.token }`;
            }
            else if ( scheme === "basic" ) {
                if ( !fields.credentials ) return;

                if ( typeof fields.credentials === "object" ) {
                    return `${ schemeName } ${ Buffer.from( `${ fields.credentials.username || "" }:${ fields.credentials.password || "" }` ).toString( "base64" ) }`;
                }
                else {
                    return `${ schemeName } ${ fields.credentials }`;
                }
            }
            else {
                const values = [];

                for ( const [ name, value ] of fields ) {
                    if ( name === "scheme" ) {
                        continue;
                    }
                    else {
                        values.push( `${ name }=${ encodeValue( value, {
                            "encode": true,
                            "quote": true,
                        } ) }` );
                    }
                }

                return `${ schemeName } ${ values.join( ", " ) }`;
            }
        }
    }
}
