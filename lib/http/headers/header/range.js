import Header from "#lib/http/headers/header";
import HttpRange from "#lib/http/range";
import { objectIsPlain } from "#lib/utils";

const NAME = "range";

export default class RangeHeader extends Header {

    // static
    static get headerName () {
        return NAME;
    }

    // properties
    get httpRange () {
        return this._getField( "httpRange" );
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
        const match = value.match( /^\s*bytes\s*=\s*/i );
        if ( !match ) return;

        value = value.slice( match[ 0 ].length ).trim();

        const list = value.split( /\s*,\s*/ ),
            ranges = [];

        for ( const item of list ) {
            // eslint-disable-next-line unicorn/better-regex
            const match = item.match( /^((?<start>\d+)-(?<end>\d+)|(?<start>\d+)-|(?<start>-\d+))$/ );
            if ( !match ) return;

            ranges.push( {
                "start": match.groups.start
                    ? Number( match.groups.start )
                    : undefined,
                "end": match.groups.end
                    ? Number( match.groups.end )
                    : undefined,
                "inclusive": true,
                "satisfiable": true,
            } );
        }

        try {
            return {
                "httpRange": new HttpRange( ranges ),
            };
        }
        catch {}
    }

    _build ( fields ) {
        return HttpRange.new( fields.httpRange ).toRangeHeader();
    }
}
