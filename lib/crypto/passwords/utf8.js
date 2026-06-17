import Range from "#lib/range";
import { compare } from "#lib/utils";
import Alphabet from "./alphabet.js";
import utf8Ranges from "./utf8-ranges.json" with { "type": "json" };

// NOTE: utf8 ranges
// https://github.com/radiovisual/unicode-range-json/blob/master/unicode-ranges.json

const RANGES = [
    [ 0x00, 0x1F, "control" ],
    [ 0x20, 0x20, "control" ], // space
    [ 0x21, 0x2F, "symbols", [ "ascii" ] ], // !"#$%&'()*+,-./
    [ 0x30, 0x39, "numbers", [ "ascii" ] ], // 0-9
    [ 0x3A, 0x40, "symbols", [ "ascii" ] ], // :;<=>?@
    [ 0x41, 0x5A, "letters-upper-case", [ "ascii" ] ], // A-Z
    [ 0x5B, 0x60, "symbols", [ "ascii" ] ], // [\]^_`
    [ 0x61, 0x7A, "letters-lower-case", [ "ascii" ] ], // a-z
    [ 0x7B, 0x7E, "symbols", [ "ascii" ] ], // {|}~
    [ 0x7F, 0x7F, "control" ], // DEL
    ...utf8Ranges.map( range => [ ...range, [ "utf8" ] ] ),
].sort( ( a, b ) => compare( a[ 0 ], b[ 0 ] ) );

const ranges = [];

for ( const [ start, end, name ] of RANGES ) {
    ranges.push( new Range( {
        name,
        start,
        end,
        "inclusive": true,
    } ) );
}

for ( let n = ranges.length - 1; n > 0; n-- ) {
    if ( ranges[ n - 1 ].end !== ranges[ n ].start ) {
        ranges.push( new Range( {
            "name": "unused",
            "start": ranges[ n - 1 ].end,
            "end": ranges[ n ].start,
        } ) );
    }
}

export default new Alphabet( "utf8", ranges );
