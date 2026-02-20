import Header from "#lib/http/headers/header";
import { decodeString, encodeValue } from "#lib/http/headers/utils";
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
    _encodeValue ( value ) {
        if ( objectIsPlain( value ) ) {
            return this._build( value );
        }
        else {
            return super._encodeValue( value );
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
                    encodeValue( fields.charset, {
                        "quote": false,
                    } ) );
        }

        if ( fields.boundary ) {
            values.push( "boundary=" +
                    encodeValue( fields.boundary, {
                        "quote": false,
                    } ) );
        }

        return values.join( "; " );
    }
}
