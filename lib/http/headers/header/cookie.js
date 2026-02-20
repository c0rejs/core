import Cookie from "#lib/http/cookie";
import Header from "#lib/http/headers/header";
import { decodeString } from "#lib/http/headers/utils";
import { objectIsPlain } from "#lib/utils";

const NAME = "cookie",
    VALUES_SEPARATOR = ";";

export default class CookieHeader extends Header {

    // static
    static get headerName () {
        return NAME;
    }

    // properties
    get valuesSeparator () {
        return VALUES_SEPARATOR;
    }

    get cookies () {
        return this._getField( "cookies" );
    }

    // protected
    _encodeValue ( value ) {
        if ( objectIsPlain( value ) ) {
            return Cookie.new( value ).toCookieHeader();
        }
        else if ( value instanceof Cookie ) {
            return value.toCookieHeader();
        }
        else {
            return super._encodeValue( value );
        }
    }

    _parse ( value, parser ) {
        const cookies = {};

        for ( const header of value.split( ";" ) ) {
            let cookie = {};

            let body,
                idx = header.indexOf( ";" );

            if ( idx < 0 ) {
                body = header;
            }
            else {
                body = header.slice( 0, idx );
            }

            idx = body.indexOf( "=" );

            if ( idx < 0 ) {
                cookie.name = "";

                cookie.value = decodeString( body.trim(), {
                    "unquote": false,
                    "decode": true,
                } );
            }
            else {
                cookie.name = decodeString( body.slice( 0, idx ).trim(), {
                    "unquote": false,
                    "decode": true,
                } );

                cookie.value = decodeString( body.slice( idx + 1 ).trim(), {
                    "unquote": false,
                    "decode": true,
                } );
            }

            cookie = new Cookie( cookie );

            cookies[ cookie.name ] = cookie;
        }

        return {
            cookies,
        };
    }
}
