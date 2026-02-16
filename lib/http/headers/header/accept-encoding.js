import Header from "#lib/http/headers/header";
import { decodeDecimal } from "#lib/http/headers/utils";

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
        const list = parser.setValue( value ).parseList();

        return {
            "encodings": new Set( list.sort( ( a, b ) => ( decodeDecimal( b.parameters.q ) ?? 1 ) - ( decodeDecimal( a.parameters.q ) ?? 1 ) ).map( item => item.value ) ),
        };
    }
}
