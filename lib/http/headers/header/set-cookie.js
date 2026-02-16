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

        for ( const value of values ) {
            const data = parser.setValue( value ).parseDictionary();
            if ( !data ) return;

            for ( const [ name, item ] of Object.entries( data ) ) {
                let cookie;

                // no "=" separator
                if ( item.value == null ) {
                    cookie = {
                        "name": "",
                        "value": decodeString( name ),
                    };
                }
                else {
                    cookie = {
                        "name": decodeString( name ),
                        "value": decodeString( item.value ),
                    };
                }

                for ( const [ attribute, value ] of Object.entries( item.parameters ) ) {
                    const [ name, decoder ] = COOKIE_ATTRIBUTES[ attribute ] ?? [];
                    if ( !name ) continue;

                    const decodedValue = decoder( value );
                    if ( decodedValue == null ) continue;

                    cookie[ name ] = decodedValue;
                }

                cookies.push( new Cookie( cookie ) );
            }
        }

        return {
            cookies,
        };
    }
}
