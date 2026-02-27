import Header from "#lib/http/headers/header";
import Range from "#lib/range";
import Ranges from "#lib/ranges";
import { isPlainObject } from "#lib/utils";

const NAME = "range";

export default class RangeHeader extends Header {

    // static
    static get headerName () {
        return NAME;
    }

    // properties
    get ranges () {
        return this._getField( "ranges" );
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
        const match = value.match( /^\s*bytes\s*=\s*/i );
        if ( !match ) return;

        value = value.slice( match[ 0 ].length ).trim();

        const list = value.split( /\s*,\s*/ ),
            ranges = [];

        for ( const item of list ) {
            // eslint-disable-next-line unicorn/better-regex
            const match = item.match( /^((?<start>\d+)-(?<end>\d+)|(?<start>\d+)-|(?<start>-\d+))$/ );
            if ( !match ) return;

            try {
                ranges.push( new Range( {
                    "start": match.groups.start
                        ? Number( match.groups.start )
                        : undefined,
                    "end": match.groups.end
                        ? Number( match.groups.end )
                        : undefined,
                    "inclusive": true,
                    "satisfiable": true,
                } ) );
            }
            catch {
                return;
            }
        }

        return {
            "ranges": new Ranges( ranges ),
        };
    }

    _build ( fields ) {
        return Ranges.new( fields.ranges ).toRangeHeader();
    }
}
