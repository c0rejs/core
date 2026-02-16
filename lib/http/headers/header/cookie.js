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
    _encodeValue ( value, { encode, quote } = {} ) {
        if ( objectIsPlain( value ) ) {
            return Cookie.new( value ).toCookieHeader();
        }
        else if ( value instanceof Cookie ) {
            return value.toCookieHeader();
        }
        else {
            return super._encodeValue( value, { encode, quote } );
        }
    }

    _parse ( value, parser ) {
        const data = parser.setValue( value ).parseDictionary( { "semicolonSeparator": true } );
        if ( !data ) return;

        var cookies = {};

        for ( const [ name, item ] of Object.entries( data ) ) {
            let cookie;

            // no "=" separator
            if ( item.value == null ) {
                cookie = new Cookie( {
                    "name": "",
                    "value": decodeString( name ),
                } );
            }
            else {
                cookie = new Cookie( {
                    "name": decodeString( name ),
                    "value": decodeString( item.value ),
                } );
            }

            cookies[ cookie.name ] = cookie;
        }

        return {
            cookies,
        };
    }
}
