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
    _encodeValue ( value ) {
        if ( objectIsPlain( value ) ) {
            return this._build( value );
        }
        else if ( value instanceof URL ) {
            return value.href;
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
        if ( !fields.url ) {
            return;
        }
        else if ( fields.url instanceof URL ) {
            return fields.url.href;
        }
        else {
            return encodeURI( fields.url );
        }
    }
}
