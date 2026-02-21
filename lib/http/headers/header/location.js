import Header from "#lib/http/headers/header";
import { isPlainObject } from "#lib/utils";

const NAME = "location";

export default class LocationHeader extends Header {

    // static
    static get headerName () {
        return NAME;
    }

    // properties
    get uri () {
        return this._getField( "uri" );
    }

    // protected
    _encodeValue ( value ) {
        if ( isPlainObject( value ) ) {
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
            "uri": decodeURI( value ),
        };
    }

    _build ( fields ) {
        if ( !fields.uri ) {
            return;
        }
        else if ( fields.uri instanceof URL ) {
            return fields.uri.href;
        }
        else {
            return encodeURI( fields.uri );
        }
    }
}
