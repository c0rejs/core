import Header from "#lib/http/headers/header";
import Range from "#lib/range";
import { objectIsPlain } from "#lib/utils";

const NAME = "content-range";

export default class ContentRangeHeader extends Header {

    // static
    static get headerName () {
        return NAME;
    }

    // properties
    get range () {
        return this._getField( "range" );
    }

    get length () {
        return this._getField( "length" );
    }

    // protected
    _encodeValue ( value, { encode, quote, utf8, language } = {} ) {
        if ( objectIsPlain( value ) ) {
            return this._build( value );
        }
        else {
            return super._encodeValue( value, { encode, quote, utf8, language } );
        }
    }

    _parse ( value, parser ) {
        const match = value.match( /^\s*bytes\s+(?<start>\d+)-(?<end>\d+)\/(?<length>\d+|\*)/i );
        if ( !match ) return;

        try {
            return {
                "range": new Range( {
                    "start": Number( match.groups.start ),
                    "end": Number( match.groups.end ),
                    "contentLength": match.groups.length === "*"
                        ? undefined
                        : Number( match.groups.length ),
                    "inclusive": true,
                    "satisfiable": true,
                    "strictBoundaries": true,
                } ),
            };
        }
        catch {}
    }

    _build ( fields ) {
        return Range.new( fields.range ).toContentRangeHeader();
    }
}
