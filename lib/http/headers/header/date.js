import Header from "#lib/http/headers/header";
import { decodeHttpDate } from "#lib/http/headers/utils";

const NAME = "date";

export default class DateHeader extends Header {

    // static
    static get headerName () {
        return NAME;
    }

    // properties
    get date () {
        return this._getField( "date" );
    }

    // protected
    _parse ( value, parser ) {
        value = decodeHttpDate( value );
        if ( !value ) return;

        return {
            "date": value,
        };
    }
}
