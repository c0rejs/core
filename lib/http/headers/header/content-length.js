import Header from "#lib/http/headers/header";

const NAME = "content-length";

export default class ContentLengthHeader extends Header {

    // static
    static get headerName () {
        return NAME;
    }

    // properties
    get bytes () {
        return this._getField( "bytes" );
    }

    // protected
    _parse ( value, parser ) {
        var bytes = Number( value );

        if ( Number.isInteger( bytes ) && bytes >= 0 ) {
            return {
                bytes,
            };
        }
    }
}
