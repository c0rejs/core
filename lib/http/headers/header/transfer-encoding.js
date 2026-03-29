import Header from "#lib/http/headers/header";
import { isPlainObject } from "#lib/utils";

const NAME = "transfer-encoding",
    ENCODINGS = new Set( [ "compress", "deflate", "gzip" ] );

export default class TransferEncodingHeader extends Header {

    // static
    static get headerName () {
        return NAME;
    }

    // properties
    get chunked () {
        return this._getField( "chunked" );
    }

    get encoding () {
        return this._getField( "encoding" );
    }

    // public
    setChunked () {
        return this._setField( "chunked", true );
    }

    deleteChunked () {
        return this._setField( "chunked" );
    }

    setEncoding ( encoding ) {
        if ( ENCODINGS.has( encoding ) ) {
            return this._setField( "encoding", encoding );
        }
        else {
            return this;
        }
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
            "chunked": false,
            "encoding": undefined,
        };

        for ( const item of list ) {
            const value = item.value.toLowerCase();

            if ( value === "chunked" ) {
                fields.chunked = true;
            }
            else if ( ENCODINGS.has( value ) ) {
                fields.encoding = value;
            }
        }

        return fields;
    }

    _build ( fields ) {
        const directives = [];

        if ( fields.encoding && ENCODINGS.has( fields.encoding ) ) {
            directives.push( fields.encoding );
        }

        if ( fields.chunked ) {
            directives.push( "chunked" );
        }

        return directives.join( ", " );
    }
}
