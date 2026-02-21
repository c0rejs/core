import path from "node:path";
import Header from "#lib/http/headers/header";
import { decodeString, encodeValue } from "#lib/http/headers/utils";
import { isPlainObject } from "#lib/utils";

const NAME = "content-disposition",
    TYPES = new Set( [ "inline", "attachment", "form-data" ] );

export default class ContentDispositionHeader extends Header {

    // static
    static get headerName () {
        return NAME;
    }

    // properties
    get type () {
        return this._getField( "type" );
    }

    get name () {
        return this._getField( "name" );
    }

    get filename () {
        return this._getField( "filename" );
    }

    // public
    setType ( value ) {
        if ( value && !TYPES.has( value ) ) {
            throw new Error( "Type is not valid" );
        }

        return this._setField( "type", value );
    }

    setName ( value ) {
        return this._setField( "name", value );
    }

    setFilename ( value ) {
        if ( value ) value = path.basename( value );

        return this._setField( "filename", value );
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
        const fields = {};

        const item = parser.parseItem( value );
        if ( !item ) return;

        const type = item.value.toLowerCase();
        if ( !TYPES.has( type ) ) return;

        fields.type = type;

        if ( item.parameters.name ) {
            fields.name = decodeString( item.parameters.name );
        }

        if ( item.parameters[ "filename*" ] ) {
            fields.filename = path.basename( decodeString( item.parameters[ "filename*" ], {
                "encoding": true,
            } ) );
        }
        else if ( item.parameters.filename ) {
            fields.filename = path.basename( decodeString( item.parameters.filename ) );
        }

        return fields;
    }

    _build ( fields ) {
        let type = fields.type;

        if ( !type ) {
            if ( fields.name ) {
                type = "form-data";
            }
            else if ( fields.filename ) {
                type = "attachment";
            }
            else {
                type = "inline";
            }
        }

        const values = [ type ];

        if ( fields.name ) {
            values.push( `name=${ encodeValue( fields.name ) }` );
        }

        if ( fields.filename ) {
            const filename = path.basename( fields.filename );

            values.push( `filename=${ encodeValue( filename ) }` );

            values.push( `filename*=${ encodeValue( filename, {
                "encoding": true,
            } ) }` );
        }

        return values.join( "; " );
    }
}
