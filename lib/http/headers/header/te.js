import Header from "#lib/http/headers/header";
import { decodeNumber } from "#lib/http/headers/utils";

const NAME = "te";

export default class TeHeader extends Header {

    // static
    static get headerName () {
        return NAME;
    }

    // properties
    get encodings () {
        return this._getField( "encodings" );
    }

    get trailers () {
        return this._getField( "trailers" );
    }

    // protected
    _parse ( value, parser ) {
        const list = parser.parseList( value );
        if ( !list ) return;

        const fields = {
            "encodings": new Set( list.sort( ( a, b ) => ( decodeNumber( b.parameters.q ) ?? 1 ) - ( decodeNumber( a.parameters.q ) ?? 1 ) ).map( item => item.value ) ),
            "trailers": undefined,
        };

        if ( fields.encodings.has( "trailers" ) ) {
            fields.encodings.delete( "trailers" );

            fields.trailers = true;
        }

        return fields;
    }
}
