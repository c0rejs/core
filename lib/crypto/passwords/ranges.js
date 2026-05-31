import AvlTree from "#lib/data-structures/avl-tree";
import Range from "#lib/range";
import ranges from "./ranges.json" with { "type": "json" };

// NOTE: utf8 ranges
// https://github.com/radiovisual/unicode-range-json/blob/master/unicode-ranges.json

const RANGES = [
    [ 0x00, 0x1F, "control" ],
    [ 0x20, 0x20, "control" ], // space
    [ 0x21, 0x2F, "symbols" ], // !"#$%&'()*+,-./
    [ 0x30, 0x39, "numbers" ], // 0-9
    [ 0x3A, 0x40, "symbols" ], // :;<=>?@
    [ 0x41, 0x5A, "letters-upper-case" ], // A-Z
    [ 0x5B, 0x60, "symbols" ], // [\]^_`
    [ 0x61, 0x7A, "letters-lower-case" ], // a-z
    [ 0x7B, 0x7E, "symbols" ], // {|}~
    [ 0x7F, 0x7F, "control" ], // DEL
    [ 0x80, 0x9F, "control" ], // utf8 reserved
    [ 0xA0, 0xFF, "Latin-1 Supplement" ],
    ...ranges,
];

const avlTree = new AvlTree();

class Utf8Ranges {

    // public
    findCodePointCategory ( codePoint ) {
        if ( typeof codePoint === "string" ) {
            codePoint = codePoint.codePointAt( 0 );
        }

        var node = avlTree.root;

        while ( node ) {
            if ( codePoint >= node.value.range.start ) {

                // range found
                if ( codePoint < node.value.range.end ) {
                    return node.value.category;
                }

                node = node.right;
            }
            else {
                node = node.left;
            }
        }
    }

    * [ Symbol.iterator ] () {
        for ( const node of avlTree ) {
            yield node.value;
        }
    }
}

export default new Utf8Ranges();

// add ranges
for ( const [ start, end, category ] of RANGES ) {
    const range = new Range( { start, end, "inclusive": true } );

    avlTree.set( range.start, {
        range,
        category,
    } );
}

var previous,
    unusedRanges = [];

for ( const node of avlTree ) {
    if ( previous ) {
        if ( previous !== node.value.range.start ) {
            unusedRanges.push( new Range( {
                "start": previous,
                "end": node.value.range.start,
                "inclusive": true,
            } ) );
        }
    }

    previous = node.value.range.end;
}

for ( const range of unusedRanges ) {
    avlTree.set( range.start, {
        range,
        "category": "unused",
    } );
}
