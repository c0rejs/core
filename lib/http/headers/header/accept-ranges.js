import Header from "#lib/http/headers/header";

const NAME = "accept-ranges";

export default class AcceptRangesHeader extends Header {

    // static
    static get headerName () {
        return NAME;
    }

    // properties
    get isRangesAccepted () {
        return this.ranges === "bytes";
    }

    get ranges () {
        return this._getField( "ranges" );
    }

    // protected
    _parse ( value, parser ) {
        if ( value === "none" ) {
            return {
                "ranges": "none",
            };
        }
        else if ( value === "bytes" ) {
            return {
                "ranges": "bytes",
            };
        }
    }
}
