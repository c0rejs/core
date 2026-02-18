import Header from "#lib/http/headers/header";
import { decodeNumber } from "#lib/http/headers/utils";

const NAME = "accept-encoding";

export default class AcceptEncodingHeader extends Header {

    // static
    static get headerName () {
        return NAME;
    }

    // properties
    get encodings () {
        return this._getField( "encodings" );
    }

    // protected
    _parse ( value, parser ) {
        const list = parser.parseList( value );
        if ( !list ) return;

        return {
            "encodings": new Set( list.sort( ( a, b ) => ( decodeNumber( b.parameters.q ) ?? 1 ) - ( decodeNumber( a.parameters.q ) ?? 1 ) ).map( item => item.value ) ),
        };
    }
}
