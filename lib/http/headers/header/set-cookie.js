import Cookie from "#lib/http/cookie";
import Header from "#lib/http/headers/header";
import { decodeBoolean, decodeHttpDate, decodeInteger, decodeString } from "#lib/http/headers/utils";
import { objectIsPlain } from "#lib/utils";

const NAME = "set-cookie",
    COOKIE_ATTRIBUTES = {
        "domain": [ "domain", decodeString ],
        "path": [ "path", decodeString ],
        "expires": [ "expires", decodeHttpDate ],
        "max-age": [ "maxAge", decodeInteger ],
        "secure": [ "secure", decodeBoolean ],
        "httponly": [ "httpOnly", decodeBoolean ],
        "partitioned": [ "partitioned", decodeBoolean ],
        "samesite": [ "sameSite", decodeString ],
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
    _encodeValue ( value, { encode, quote } = {} ) {
        if ( objectIsPlain( value ) ) {
            return Cookie.new( value ).toSetCookieHeader();
        }
        else if ( value instanceof Cookie ) {
            return value.toSetCookieHeader();
        }
        else {
            return super._encodeValue( value, { encode, quote } );
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
                header = header.slice( idx );
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

            const parameters = parser.setValue( header ).parseParameters();
            if ( !parameters ) continue;

            for ( const [ key, value ] of Object.entries( parameters ) ) {
                const [ name, decoder ] = COOKIE_ATTRIBUTES[ key ] ?? [];
                if ( !name ) continue;

                const decodedValue = decoder( value );
                if ( decodedValue == null ) continue;

                cookie[ name ] = decodedValue;
            }

            cookies.push( new Cookie( cookie ) );
        }

        return {
            cookies,
        };
    }
}
