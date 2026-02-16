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
    _encodeValue ( value, { encode, quote } = {} ) {
        if ( objectIsPlain( value ) ) {
            return encodeEtag( value.etag, {
                "weak": value.weak,
            } );
        }
        else {
            return super._encodeValue( value, { encode, quote } );
        }
    }

    get etags () {
        return this._getField( "etags" );
    }

    // protected
    _parse ( value, parser ) {
        const list = parser.setValue( value ).parseList( { "bare": true } );
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
