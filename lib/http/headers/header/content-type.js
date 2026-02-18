import Header from "#lib/http/headers/header";
import { decodeString } from "#lib/http/headers/utils";
import { objectIsPlain } from "#lib/utils";

const NAME = "content-type";

export default class ContentTypeHeader extends Header {

    // static
    static get headerName () {
        return NAME;
    }

    // properties
    get type () {
        return this._getField( "type" );
    }

    get charset () {
        return this._getField( "charset" );
    }

    get boundary () {
        return this._getField( "boundary" );
    }

    // protected
    _encodeValue ( value, { encode, quote } = {} ) {
        if ( objectIsPlain( value ) ) {
            return this._build( value );
        }
        else {
            return super._encodeValue( value, { encode, quote } );
        }
    }

    _parse ( value, parser ) {
        const item = parser.parseItem( value );
        if ( !item ) return;

        const type = decodeString( item.value );
        if ( !type ) return;

        return {
            type,
            "charset": decodeString( item.parameters.charset ).toLowerCase(),
            "boundary": decodeString( item.parameters.boundary ),
        };
    }

    _build ( fields ) {
        const values = [];

        if ( !fields.type ) return;

        values.push( fields.type );

        if ( fields.charset ) {
            values.push( "charset=" +
                    this._encodeValue( fields.charset, {
                        "encode": true,
                        "quote": true,
                    } ) );
        }

        if ( fields.boundary ) {
            values.push( "boundary=" +
                    this._encodeValue( fields.boundary, {
                        "encode": true,
                        "quote": true,
                    } ) );
        }

        return values.join( "; " );
    }
}
