import Header from "#lib/http/headers/header";
import { decodeString } from "#lib/http/headers/utils";

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
    _parse ( value, parser ) {
        const fields = {};

        const match = value.match( /^(?<scheme>[\w-]+)\s+/ );
        if ( !match ) return;

        fields.scheme = match.groups.scheme.toLowerCase();

        value = value.slice( match[ 0 ].length );

        const data = parser.parseDictionary( value, { "bare": true } );
        if ( !data ) return;

        for ( const [ key, item ] of Object.entries( data ) ) {
            fields[ key ] = decodeString( item.value );
        }

        return fields;
    }
}
