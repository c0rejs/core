import Header from "#lib/http/headers/header";
import { encodeEtag } from "#lib/http/headers/utils";
import { objectIsPlain } from "#lib/utils";

const NAME = "etag";

export default class EtagHeader extends Header {

    // static
    static get headerName () {
        return NAME;
    }

    // properties
    get etag () {
        return this._getField( "etag" );
    }

    get isWeak () {
        return this._getField( "isWeak" );
    }

    // protected
    _encodeValue ( value ) {
        if ( objectIsPlain( value ) ) {
            return this._build( value );
        }
        else {
            return super._encodeValue( value );
        }
    }

    _parse ( value, parser ) {
        const etag = parser.parseItem( value, { "bare": true } );
        if ( !etag ) return;

        return {
            "etag": etag.value,
            "isWeak": etag.value.startsWith( "W/" ),
        };
    }

    _build ( fields ) {
        return encodeEtag( fields.etag, {
            "weak": fields.weak,
        } );
    }
}
