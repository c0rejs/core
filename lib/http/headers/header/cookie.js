import Cookie from "#lib/http/cookie";
import Header from "#lib/http/headers/header";
import { isPlainObject } from "#lib/utils";

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
        if ( isPlainObject( value ) ) {
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

                cookie.value = decodeURIComponent( body.trim() );
            }
            else {
                cookie.name = decodeURIComponent( body.slice( 0, idx ).trim() );

                cookie.value = decodeURIComponent( body.slice( idx + 1 ).trim() );
            }

            cookie = new Cookie( cookie );

            cookies[ cookie.name ] = cookie;
        }

        return {
            cookies,
        };
    }
}
