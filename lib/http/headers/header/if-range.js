import Header from "#lib/http/headers/header";
import { decodeHttpDate } from "#lib/http/headers/utils";

const NAME = "if-range";

export default class IfRangeHeader extends Header {

    // static
    static get headerName () {
        return NAME;
    }

    // properties
    get date () {
        return this._getField( "date" );
    }

    get etag () {
        return this._getField( "etag" );
    }

    // protected
    _parse ( value, parser ) {
        var item = parser.parseItem( value, { "bare": true } );
        if ( !item ) return;

        const date = decodeHttpDate( item.value );

        if ( date ) {
            return {
                date,
            };
        }
        else {
            return {
                "etag": item.value,
            };
        }
    }
}
