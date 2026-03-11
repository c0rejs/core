import path from "node:path";
import Header from "#lib/http/headers/header";
import { decodeString, encodeString } from "#lib/http/headers/utils";
import { isPlainObject } from "#lib/utils";

const NAME = "content-disposition",
    TYPES = new Set( [ "inline", "attachment", "form-data" ] );

const formdataEscape = str => str.replaceAll( "\n", "%0A" ).replaceAll( "\r", "%0D" ).replaceAll( '"', "%22" ),
    normalizeLinefeeds = value => value.replaceAll( /\r?\n|\r/g, "\r\n" );

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

        // name
        if ( item.parameters.name ) {
            let value = item.parameters.name;

            value = decodeString( value, { "unescape": false } );

            fields.name = value.replaceAll( /%0a/gi, "\n" ).replaceAll( /%0d/gi, "\r" ).replaceAll( "%22", '"' );
        }

        // filename
        if ( item.parameters[ "filename*" ] ) {
            fields.filename = path.basename( decodeString( item.parameters[ "filename*" ], {
                "rfc5987": true,
            } ) );
        }

        if ( fields.filename == null && item.parameters.filename ) {
            let value = item.parameters.filename;

            value = decodeString( value, { "unescape": false } );

            fields.filename = path.basename( value.replaceAll( /%0a/gi, "\n" ).replaceAll( /%0d/gi, "\r" ).replaceAll( "%22", '"' ) );
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

        // name
        if ( fields.name ) {
            values.push( `name="${ formdataEscape( normalizeLinefeeds( fields.name ) ) }"` );
        }

        // filename
        if ( fields.filename ) {
            const filename = fields.filename;

            values.push( `filename="${ formdataEscape( filename ) }"` );

            values.push( `filename*=${ encodeString( filename, {
                "rfc5987": true,
            } ) }` );
        }

        return values.join( "; " );
    }
}
