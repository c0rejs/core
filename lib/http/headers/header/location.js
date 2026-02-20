import Header from "#lib/http/headers/header";
import { objectIsPlain } from "#lib/utils";

const NAME = "location";

export default class LocationHeader extends Header {

    // static
    static get headerName () {
        return NAME;
    }

    // properties
    get url () {
        return this._getField( "url" );
    }

    // protected
    _encodeValue ( value, { encode, quote, utf8, language } = {} ) {
        if ( objectIsPlain( value ) ) {
            return this._build( value );
        }
        else {
            return encodeURI( value );
        }
    }

    _parse ( value, parser ) {
        return {
            "url": decodeURI( value ),
        };
    }

    _build ( fields ) {
        return encodeURI( fields.url );
    }
}
