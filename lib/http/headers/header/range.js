import Header from "#lib/http/headers/header";
import HttpRange from "#lib/http/range";

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
    _parse ( value, parser ) {
        const match = parser.setValue( value ).parse( /^bytes\s+=\s+/ );
        if ( !match ) return;

        const list = parser.value.split( /\s*,\s*/ ),
            ranges = [];

        for ( const item of list ) {
            // eslint-disable-next-line unicorn/better-regex
            const match = item.match( /^((?<start>\d+)-(?<end>\d+)|(?<start>\d+)-|(?<end>-\d+))$/ );
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

        return {
            "httpRange": new HttpRange( ranges ),
        };
    }
}
