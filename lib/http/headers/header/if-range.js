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
        var item = parser.setValue( value ).parsBareItem();
        if ( !item ) return;

        item = decodeHttpDate( item ) ?? item;

        if ( item instanceof Date ) {
            return {
                "date": item,
            };
        }
        else {
            return {
                "etag": item,
            };
        }
    }
}
