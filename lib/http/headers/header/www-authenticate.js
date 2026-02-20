import Header from "#lib/http/headers/header";
import { AUTH_SCHEMES } from "#lib/http/headers/names";
import { decodeValue, encodeValue } from "#lib/http/headers/utils";
import { objectIsPlain } from "#lib/utils";

const NAME = "www-authenticate";

export default class WwwAuthenticateHeader extends Header {

    // static
    static get headerName () {
        return NAME;
    }

    // properties
    get scheme () {
        return this._getField( "scheme" );
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
    _encodeValue ( value ) {
        if ( objectIsPlain( value ) ) {
            return this._build( value );
        }
        else {
            return super._encodeValue( value );
        }
    }

    _parse ( value, parser ) {
        const fields = {};

        const match = value.match( /^(?<scheme>[\w-]+)\s+/ );
        if ( !match ) return;

        fields.scheme = match.groups.scheme.toLowerCase();

        value = value.slice( match[ 0 ].length );

        const data = parser.parseDictionary( value, { "bare": true } );
        if ( !data ) return;

        for ( const [ key, item ] of Object.entries( data ) ) {
            fields[ key ] = decodeValue( item.value, {
                "unquote": true,
                "decode": true,
            } );
        }

        return fields;
    }

    _build ( fields ) {
        if ( !fields.scheme ) {
            return;
        }
        else {
            const scheme = fields.scheme.toLowerCase(),
                schemeName = AUTH_SCHEMES[ scheme ] || scheme,
                values = [];

            for ( const [ name, value ] of fields ) {
                if ( name === "scheme" ) {
                    continue;
                }
                else {
                    values.push( `${ name }=${ encodeValue( value ) }` );
                }
            }

            return `${ schemeName } ${ values.join( ", " ) }`;
        }
    }
}
