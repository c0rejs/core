import Cookie from "#lib/http/cookie";
import Header from "#lib/http/headers/header";
import { decodeBoolean, decodeHttpDate, decodeInteger, decodeString } from "#lib/http/headers/utils";
import { objectIsPlain } from "#lib/utils";

const NAME = "set-cookie",
    COOKIE_ATTRIBUTES = {
        "domain": [ "domain", decodeString ],
        "expires": [ "expires", decodeHttpDate ],
        "httponly": [ "httpOnly", decodeBoolean ],
        "max-age": [ "maxAge", decodeInteger ],
        "partitioned": [ "partitioned", decodeBoolean ],
        "path": [ "path", decodeString ],
        "priority": [ "priority", decodeString ],
        "samesite": [ "sameSite", decodeString ],
        "secure": [ "secure", decodeBoolean ],
    };

export default class SetCookieHeader extends Header {

    // static
    static get headerName () {
        return NAME;
    }

    // properties
    get valuesSeparator () {
        return;
    }

    get cookies () {
        return this._getField( "cookies" );
    }

    // protected
    _encodeValue ( value ) {
        if ( objectIsPlain( value ) ) {
            return Cookie.new( value ).toSetCookieHeader();
        }
        else if ( value instanceof Cookie ) {
            return value.toSetCookieHeader();
        }
        else {
            return super._encodeValue( value );
        }
    }

    _parse ( values, parser ) {
        const cookies = [];

        for ( let header of values ) {
            const cookie = {};

            let body,
                idx = header.indexOf( ";" );

            if ( idx < 0 ) {
                body = header;
                header = "";
            }
            else {
                body = header.slice( 0, idx );
                header = header.slice( idx + 1 );
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

            const attributes = parser.parseDictionary( header, { "bare": true, "semicolon": true } );
            if ( !attributes ) continue;

            for ( const attribute of Object.values( attributes ) ) {
                const [ name, decoder ] = COOKIE_ATTRIBUTES[ attribute.key ] ?? [];
                if ( !name ) continue;

                const value = decoder( attribute.value );
                if ( value == null ) continue;

                cookie[ name ] = value;
            }

            cookies.push( new Cookie( cookie ) );
        }

        return {
            cookies,
        };
    }
}
