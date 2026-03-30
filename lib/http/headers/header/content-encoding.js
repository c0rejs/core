import Header from "#lib/http/headers/header";
import { isPlainObject } from "#lib/utils";

const NAME = "content-encoding",
    ENCODINGS = new Set( [ "gzip", "compress", "deflate", "br", "zstd", "dcb", "dcz" ] );

export default class ContentEncodingHeader extends Header {

    // static
    static get headerName () {
        return NAME;
    }

    // properties
    get encodings () {
        return this._getField( "encodings" );
    }

    // protected
    _encodeValue ( value ) {
        if ( isPlainObject( value ) ) {
            return this._build( value );
        }
        else {
            return super._encodeValue( value );
        }
    }

    _parse ( value, parser ) {
        const list = parser.parseList( value, { "bare": true } );
        if ( !list ) return;

        const fields = {
            "encodings": undefined,
        };

        for ( const item of list ) {
            const value = item.value.toLowerCase();

            if ( ENCODINGS.has( value ) ) {
                fields.encodings ??= new Set();

                fields.encodings.add( value );
            }
        }

        return fields;
    }

    _build ( fields ) {
        const directives = [];

        if ( fields.encodings ) {
            for ( const encoding of fields.encodings ) {
                if ( !ENCODINGS.has( encoding ) ) continue;

                directives.push( encoding );
            }
        }

        return directives.join( ", " );
    }
}
