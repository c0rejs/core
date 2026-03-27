import Header from "#lib/http/headers/header";
import { isPlainObject } from "#lib/utils";

const NAME = "transfer-encoding",
    DIRECTIVES = new Set( [ "chunked", "compress", "deflate", "gzip" ] );

export default class TransferEncodingHeader extends Header {

    // static
    static get headerName () {
        return NAME;
    }

    // properties
    get chunked () {
        return this._getField( "chunked" );
    }

    get compress () {
        return this._getField( "compress" );
    }

    get deflate () {
        return this._getField( "deflate" );
    }

    get gzip () {
        return this._getField( "gzip" );
    }

    // public
    setChunked () {
        return this._setField( "chunked", true );
    }

    deleteChunked () {
        return this._setField( "chunked" );
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

        const fields = {};

        for ( const item of list ) {
            const value = item.value.toLowerCase();

            if ( !DIRECTIVES.has( value ) ) continue;

            fields[ value ] = true;
        }

        return fields;
    }

    _build ( fields ) {
        const directives = [];

        for ( const [ key, value ] of Object.entries( fields ) ) {
            if ( !DIRECTIVES.has( key ) ) continue;

            if ( value === true ) {
                directives.push( key );
            }
        }

        return directives.join( ", " );
    }
}
