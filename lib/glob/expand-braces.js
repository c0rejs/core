import createSequenceRegExp from "#lib/glob/brace-sequence";
import Uuid from "#lib/uuid";

const INTEGER_REGEXP = /^-?\d+$/v;

// public
export default function expandBraces ( pattern ) {
    const sequences = {},
        ast = scanContent( pattern, 0, false ).nodes,
        patterns = new Set( cartesianProduct( ast.map( node => expandNode( node, sequences, {} ) ) ) );

    return { patterns, sequences };
}

// private
function cartesianProduct ( lists ) {
    return lists.reduce(
        ( combinations, list ) => {
            const next = [];

            for ( const combination of combinations ) {
                for ( const value of list ) {
                    next.push( combination + value );
                }
            }

            return next;
        },
        [ "" ]
    );
}

function expandNode ( node, sequences, cache ) {
    if ( typeof node === "string" ) {
        return [ node ];
    }
    else if ( Array.isArray( node ) ) {
        return node.flatMap( value => expandNode( value, sequences, cache ) );
    }
    else if ( node ) {
        let id = cache[ node.value ];

        // cache sequence regexp
        if ( !id ) {
            id = Uuid.v4();

            cache[ node.value ] = id;

            sequences[ id ] = createSequenceRegExp( {
                "start": node.start,
                "end": node.end,
                "step": node.step,
            } );
        }

        return [ `\0${ id }` ];
    }
    else {
        return [ "" ];
    }
}

function scanContent ( value, start, insideGroup ) {
    const nodes = [];
    let text = "",
        n = start;

    const flush = () => {
        if ( text ) {
            nodes.push( text );
            text = "";
        }
    };

    while ( n < value.length ) {
        const char = value[ n ];

        if ( insideGroup && ( char === "," || char === "}" ) ) break;

        if ( char === "\\" ) {
            const item = readEscaped( value, n );
            text += value.slice( n, item.next );
            n = item.next;
            continue;
        }

        if ( char !== "{" ) {
            text += char;
            n++;
            continue;
        }

        const group = parseGroup( value, n );

        if ( group.node ) {
            flush();
            nodes.push( group.node );
        }
        else {
            text += value.slice( n, group.next );
        }

        n = group.next;
    }

    flush();

    return { nodes, "next": n };
}

// parses a `{...}` group starting at `value[ start ]`, recursively
// scanning each comma-separated alternative with `#scanContent` -
// the group's own extent (and any nested groups within it) falls
// out of that recursion instead of a separate bracket-matching pass.
// returns `node: null` when the group is unclosed, or closed but not
// a valid alternation (2+ alternatives) or `{start..end[..step]}`
// sequence; the caller then treats it as literal text
function parseGroup ( value, start ) {
    const alternatives = [];

    let n = start + 1,
        rawStart = n;

    for ( ;; ) {
        const { nodes, next } = scanContent( value, n, true );

        // ran off the end without hitting `,` or `}` - unclosed group,
        // only the opening `{` itself is treated as literal
        if ( next >= value.length ) {
            return { "node": null, "next": start + 1 };
        }

        alternatives.push( { "raw": value.slice( rawStart, next ), nodes } );

        if ( value[ next ] === "," ) {
            n = next + 1;
            rawStart = n;
            continue;
        }

        const closeIndex = next,
            resultNode = alternatives.length > 1
                ? buildAlternatives( alternatives )
                : parseSequence( alternatives[ 0 ].raw );

        return { "node": resultNode ?? null, "next": closeIndex + 1 };
    }
}

// each alternative is represented recursively. A single node is stored
// directly; multiple nodes are stored as a nested array so no information
// is lost.
function buildAlternatives ( alternatives ) {
    return alternatives.map( alternative => {
        if ( alternative.nodes.length === 0 ) {
            return "";
        }

        if ( alternative.nodes.length === 1 ) {
            return alternative.nodes[ 0 ];
        }

        return alternative.nodes;
    } );
}

function parseSequence ( value ) {
    const parts = splitOnDots( value );

    if ( parts.length !== 2 && parts.length !== 3 ) return;

    const start = unescape( parts[ 0 ] ),
        end = unescape( parts[ 1 ] );

    if ( !start || !end ) return;

    const startType = INTEGER_REGEXP.test( start )
            ? 1
            : start.length === 1
                ? 2
                : 3,
        endType = INTEGER_REGEXP.test( end )
            ? 1
            : end.length === 1
                ? 2
                : 4;

    if ( startType !== endType ) return;

    let step;

    // parse step
    if ( parts.length === 3 ) {
        step = unescape( parts[ 2 ] );

        if ( !INTEGER_REGEXP.test( step ) ) return;

        step = Number( step );

        if ( step === 0 ) return;
    }

    return { value, start, end, step };
}

// splits `value` on top-level `..` separators, ignoring any that fall
// inside a nested `{...}` group (e.g. the `..` in `{1..2}..z`)
function splitOnDots ( value ) {
    const parts = [];
    let start = 0,
        maxDepth = 0;

    for ( let n = 0; n < value.length; n++ ) {
        if ( value[ n ] === "\\" ) {
            n++;
            continue;
        }

        if ( value[ n ] === "{" ) {
            maxDepth++;
            continue;
        }

        if ( value[ n ] === "}" ) {
            maxDepth--;
            continue;
        }

        if ( maxDepth === 0 && value.startsWith( "..", n ) ) {
            parts.push( value.slice( start, n ) );
            n += 1;
            start = n + 1;
        }
    }

    parts.push( value.slice( start ) );

    return parts;
}

function readEscaped ( value, index ) {
    if ( value[ index ] !== "\\" ) {
        return { "value": value[ index ], "next": index + 1 };
    }

    if ( index + 1 >= value.length ) {
        return { "value": "\\", "next": index + 1 };
    }

    return { "value": value[ index + 1 ], "next": index + 2 };
}

function unescape ( value ) {
    let result = "";

    for ( let n = 0; n < value.length; n++ ) {
        const item = readEscaped( value, n );
        result += item.value;
        n = item.next - 1;
    }

    return result;
}
