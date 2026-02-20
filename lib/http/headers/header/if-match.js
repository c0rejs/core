import Header from "#lib/http/headers/header";
import { encodeEtag } from "#lib/http/headers/utils";
import { objectIsPlain } from "#lib/utils";

const NAME = "if-match";

export default class IfMatchHeader extends Header {

    // static
    static get headerName () {
        return NAME;
    }

    // properties
    get etags () {
        return this._getField( "etags" );
    }

    // protected
    _encodeValue ( value ) {
        if ( objectIsPlain( value ) ) {
            return encodeEtag( value.etag, {
                "weak": value.weak,
            } );
        }
        else {
            return super._encodeValue( value );
        }
    }

    _parse ( value, parser ) {
        const list = parser.parseList( value, { "bare": true } );
        if ( !list ) return;

        const etags = new Set();

        for ( const item of list ) {
            if ( !item.value ) continue;

            etags.add( item.value );
        }

        return {
            etags,
        };
    }
}
