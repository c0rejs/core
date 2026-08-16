const serializeCache = new WeakMap(),
    NUMBER_REGEXP = /^[+\-]?\d+$/v,
    DIGITS_ONLY_REGEXP = /^\d+$/v,
    RANGE_ESCAPE = new Set( [ "[", "]", "(", ")", "{", "}", "/", "-", "|" ] ),
    MAX_SAFE_INTEGER_BIG = BigInt( Number.MAX_SAFE_INTEGER ),
    ENUMERATION_TERM_CAP = 200_000n,
    SLASH_CODEPOINT = "/".codePointAt( 0 );

// public
export default function createSequenceRegExp ( { start, end, step } ) {
    let startIsNumber, endIsNumber;

    if ( typeof start === "number" ) {
        startIsNumber = true;
        start = String( start );
    }
    else if ( NUMBER_REGEXP.test( start ) ) {
        startIsNumber = true;
    }
    else {
        startIsNumber = false;
    }

    if ( typeof end === "number" ) {
        endIsNumber = true;
        end = String( end );
    }
    else if ( NUMBER_REGEXP.test( end ) ) {
        endIsNumber = true;
    }
    else {
        endIsNumber = false;
    }

    if ( startIsNumber !== endIsNumber ) throw new TypeError( "Braces sequence start and end must have the same type" );

    if ( step ) {
        step = Number( step );

        if ( !Number.isSafeInteger( step ) ) {
            throw new TypeError( "Braces sequence step must be a safe integer" );
        }
    }

    step ||= 1;

    if ( startIsNumber ) {
        return numericSequenceToRegExp( start, end, step );
    }
    else {
        return charSequenceToRegExp( start, end, step );
    }
}

// private
function charSequenceToRegExp ( start, end, step ) {
    start = start.codePointAt( 0 );
    end = end.codePointAt( 0 );
    step = Math.abs( step );

    if ( start > end ) [ start, end ] = [ end, start ];

    if ( start === end ) {
        return "[" + createRangeCharFromCodePoint( start ) + "]";
    }
    else if ( step === 1 ) {
        return "[" + codePointRangeToClassBody( start, end ) + "]";
    }
    else {
        const chars = [];

        for ( let codePoint = start; codePoint <= end; codePoint += step ) {
            if ( codePoint === SLASH_CODEPOINT ) continue;

            chars.push( createRangeCharFromCodePoint( codePoint ) );
        }

        if ( chars.length === 0 ) {
            throw new Error( "Braces sequence range can not contain path separator" );
        }

        return "[" + chars.join( "" ) + "]";
    }
}

function codePointRangeToClassBody ( start, end ) {
    if ( start > SLASH_CODEPOINT || end < SLASH_CODEPOINT ) {
        return rangeFragment( start, end );
    }

    const fragments = [];

    if ( start < SLASH_CODEPOINT ) fragments.push( rangeFragment( start, SLASH_CODEPOINT - 1 ) );
    if ( end > SLASH_CODEPOINT ) fragments.push( rangeFragment( SLASH_CODEPOINT + 1, end ) );

    if ( fragments.length === 0 ) {
        throw new Error( "Braces sequence range can not contain path separator" );
    }

    return fragments.join( "" );
}

function rangeFragment ( start, end ) {
    return start === end
        ? createRangeCharFromCodePoint( start )
        : createRangeCharFromCodePoint( start ) + "-" + createRangeCharFromCodePoint( end );
}

function createRangeCharFromCodePoint ( codePoint ) {

    // control codes
    if ( codePoint <= 0x1F || codePoint === 0x7F ) {
        return "\\x" + codePoint.toString( 16 );
    }
    else {
        const char = String.fromCodePoint( codePoint );

        if ( char === "/" || char === "\\" ) {
            throw new Error( "Braces sequence range can not contain path separator" );
        }
        else if ( RANGE_ESCAPE.has( char ) ) {
            return "\\" + char;
        }
        else {
            return char;
        }
    }
}

function numericSequenceToRegExp ( start, end, step ) {
    const absStart = start.replace( /^[+\-]/v, "" ),
        absEnd = end.replace( /^[+\-]/v, "" ),
        padWidth = absStart.startsWith( "0" ) || absEnd.startsWith( "0" )
            ? Math.max( absStart.length, absEnd.length )
            : null;

    start = BigInt( start );
    end = BigInt( end );

    if ( start > end ) [ start, end ] = [ end, start ];

    step = BigInt( step );

    if ( step === 0n ) {
        throw new RangeError( `Invalid sequence step: ${ step }` );
    }
    else if ( step < 0n ) {
        step = -step;
    }

    const lastTerm = start + ( ( end - start ) / step ) * step;

    if ( lastTerm < 0n ) {
        return "-" + magnitudeRangeToRegExp( -lastTerm, -start, step, padWidth );
    }
    else if ( start >= 0n ) {
        return magnitudeRangeToRegExp( start, lastTerm, step, padWidth );
    }
    else {
        const stepsToNonNegative = ( -start + step - 1n ) / step,
            firstNonNegTerm = start + stepsToNonNegative * step,
            lastNegTerm = firstNonNegTerm - step,
            parts = [ "-" + magnitudeRangeToRegExp( -lastNegTerm, -start, step, padWidth ) ];

        if ( firstNonNegTerm <= lastTerm ) {
            parts.push( magnitudeRangeToRegExp( firstNonNegTerm, lastTerm, step, padWidth ) );
        }

        return parts.length === 1
            ? parts[ 0 ]
            : `(?:${ parts.join( "|" ) })`;
    }
}

function magnitudeRangeToRegExp ( start, end, stepBig, width ) {
    if ( width != null ) {
        return fixedWidthMagnitudeRangeToRegExp( start, end, stepBig, width );
    }

    const parts = [];

    let segmentStart = start;

    while ( segmentStart <= end ) {
        const segmentWidth = segmentStart.toString().length,
            segmentCeiling = 10n ** BigInt( segmentWidth ) - 1n,
            segmentBound = segmentCeiling < end
                ? segmentCeiling
                : end,
            segmentEnd = start + ( ( segmentBound - start ) / stepBig ) * stepBig;

        parts.push( fixedWidthMagnitudeRangeToRegExp( segmentStart, segmentEnd, stepBig, segmentWidth ) );

        segmentStart = segmentEnd + stepBig;
    }

    return parts.length === 1
        ? parts[ 0 ]
        : `(?:${ parts.join( "|" ) })`;
}

function fixedWidthMagnitudeRangeToRegExp ( start, end, stepBig, width ) {
    if ( start === end ) return start.toString().padStart( width, "0" );

    if ( stepBig === 1n ) {
        return numericRangeToRegExp( start.toString().padStart( width, "0" ), end.toString().padStart( width, "0" ) );
    }

    const count = ( end - start ) / stepBig + 1n,
        stepFitsInNumber = stepBig <= MAX_SAFE_INTEGER_BIG,
        enumerationCost = count * BigInt( width ),
        dfaCost = stepFitsInNumber
            ? BigInt( width ) * stepBig * 4n
            : null;

    const useEnumeration = dfaCost === null
        ? true
        : enumerationCost <= dfaCost;

    if ( useEnumeration ) {
        if ( count > ENUMERATION_TERM_CAP ) {
            throw new RangeError( `Braces sequence step is too large relative to the range to build an automaton, and too small to enumerate (step: ${ stepBig }, terms: ${ count })` );
        }

        const values = [];

        for ( let n = start; n <= end; n += stepBig ) {
            values.push( n.toString().padStart( width, "0" ) );
        }

        return optimizeLiteralSet( values );
    }

    const dfa = buildSteppedDfa( start, end, stepBig, width ),
        minimized = minimizeDfa( dfa ),
        ast = optimizeRegexAst( dfaToAst( minimized ) );

    return serializeRegexAst( ast );
}

function numericRangeToRegExp ( minRaw, maxRaw ) {
    const width = minRaw.length,
        min = BigInt( minRaw ),
        max = BigInt( maxRaw ),
        powers = decimalPowers( width ),
        fragments = [];

    function visit ( prefix, value, remaining ) {
        const blockSize = powers[ remaining ],
            blockEnd = value + blockSize - 1n;

        if ( value >= min && blockEnd <= max ) {
            fragments.push( prefix + wildcardDigits( remaining ) );
            return;
        }

        if ( remaining === 0 ) return;

        const childSize = powers[ remaining - 1 ];

        for ( let digit = 0; digit <= 9; digit++ ) {
            const childValue = value + BigInt( digit ) * childSize,
                childEnd = childValue + childSize - 1n;

            if ( childEnd < min || childValue > max ) continue;

            visit( prefix + String( digit ), childValue, remaining - 1 );
        }
    }

    visit( "", 0n, width );
    return optimizeLiteralSet( fragments );
}

function buildSteppedDfa ( start, end, step, width ) {
    if ( step > MAX_SAFE_INTEGER_BIG ) {
        throw new RangeError( "Exact DFA requires step <= Number.MAX_SAFE_INTEGER" );
    }

    const modulus = Number( step ),
        targetRemainder = Number( start % step );

    const minDigits = bigintToDigits( start, width ),
        maxDigits = bigintToDigits( end, width );

    const states = [],
        stateMap = new Map();

    function getState ( position, remainder, lower, upper ) {
        const key = `${ position }:${ remainder }:${ lower
            ? 1
            : 0 }:${ upper
            ? 1
            : 0 }`;

        const existing = stateMap.get( key );
        if ( existing !== undefined ) return existing;

        const id = states.length;

        states.push( {
            position,
            remainder,
            lower,
            upper,
            "accepting": false,
            "transitions": new Map(),
        } );

        stateMap.set( key, id );
        return id;
    }

    const startId = getState( 0, 0, true, true ),
        queue = [ startId ];

    for ( let q = 0; q < queue.length; q++ ) {
        const id = queue[ q ],
            state = states[ id ];

        if ( state.position === width ) {
            state.accepting = state.remainder === targetRemainder;
            continue;
        }

        const lo = state.lower
            ? minDigits[ state.position ]
            : 0;
        const hi = state.upper
            ? maxDigits[ state.position ]
            : 9;

        for ( let digit = lo; digit <= hi; digit++ ) {
            const remainder = ( state.remainder * 10 + digit ) % modulus;

            const lower = state.lower && digit === minDigits[ state.position ];

            const upper = state.upper && digit === maxDigits[ state.position ];

            const next = getState( state.position + 1, remainder, lower, upper );

            state.transitions.set( digit, next );

            if ( next >= queue.length ) queue.push( next );
        }
    }

    return { states, "start": startId };
}

function minimizeDfa ( dfa ) {
    const oldStates = dfa.states,
        classes = new Array( oldStates.length ),
        signatures = new Map();

    /*
     * The DFA is acyclic: every edge advances position.
     * Therefore bottom-up equivalence classification is enough.
     */
    for ( let i = oldStates.length - 1; i >= 0; i-- ) {
        const state = oldStates[ i ],
            targets = new Array( 10 ).fill( -1 );

        for ( const [ digit, target ] of state.transitions ) {
            targets[ digit ] = classes[ target ];
        }

        const signature = `${ state.accepting
            ? 1
            : 0 }|${ targets.join( "," ) }`;

        let classId = signatures.get( signature );

        if ( classId === undefined ) {
            classId = signatures.size;
            signatures.set( signature, classId );
        }

        classes[ i ] = classId;
    }

    const count = signatures.size,
        representative = new Array( count );

    for ( let i = 0; i < classes.length; i++ ) {
        const classId = classes[ i ];
        if ( representative[ classId ] === undefined ) {
            representative[ classId ] = i;
        }
    }

    const states = new Array( count );

    for ( let classId = 0; classId < count; classId++ ) {
        const old = oldStates[ representative[ classId ] ],
            transitions = new Map();

        for ( const [ digit, target ] of old.transitions ) {
            transitions.set( digit, classes[ target ] );
        }

        states[ classId ] = {
            "accepting": old.accepting,
            transitions,
        };
    }

    return {
        states,
        "start": classes[ dfa.start ],
    };
}

function emptyNode () {
    return { "type": "empty" };
}

function failNode () {
    return { "type": "fail" };
}

function literalNode ( value ) {
    return { "type": "literal", value };
}

function classNode ( chars ) {
    return { "type": "class", chars };
}

function alternationNode ( parts ) {
    const flat = [];

    for ( const part of parts ) {
        if ( part.type === "fail" ) continue;

        if ( part.type === "alternation" ) {
            flat.push( ...part.parts );
        }
        else {
            flat.push( part );
        }
    }

    if ( flat.length === 0 ) return failNode();
    if ( flat.length === 1 ) return flat[ 0 ];

    return { "type": "alternation", "parts": flat };
}

function optionalNode ( node ) {
    return { "type": "optional", node };
}

function dfaToAst ( dfa ) {
    const memo = new Map();

    function visit ( id ) {
        const cached = memo.get( id );
        if ( cached !== undefined ) return cached;

        const state = dfa.states[ id ],
            grouped = new Map();

        for ( const [ digit, target ] of state.transitions ) {
            let digits = grouped.get( target );

            if ( !digits ) {
                digits = [];
                grouped.set( target, digits );
            }

            digits.push( digit );
        }

        const alternatives = [];

        for ( const [ target, digits ] of grouped ) {
            alternatives.push( optimizeConcat( [ digitsToAst( digits ), visit( target ) ] ) );
        }

        if ( state.accepting ) {
            alternatives.push( emptyNode() );
        }

        const result = optimizeAlternation( alternatives );

        memo.set( id, result );
        return result;
    }

    return visit( dfa.start );
}

function digitsToAst ( digits ) {
    const sorted = [ ...new Set( digits ) ].sort( ( a, b ) => a - b );

    if ( sorted.length === 1 ) {
        return literalNode( String( sorted[ 0 ] ) );
    }

    if ( sorted.length === 10 && sorted.every( ( digit, i ) => digit === i ) ) {
        return literalNode( "\\d" );
    }

    return classNode( sorted.map( String ) );
}

function optimizeRegexAst ( node ) {
    switch ( node.type ) {
        case "empty":
        case "fail":
        case "literal":
        case "class":
            return node;

        case "optional":
            return optionalNode( optimizeRegexAst( node.node ) );

        case "concat":
            return optimizeConcat( node.parts.map( optimizeRegexAst ) );

        case "alternation":
            return optimizeAlternation( node.parts.map( optimizeRegexAst ) );

        default:
            throw new Error( `Unknown regex AST node: ${ node.type }` );
    }
}

function optimizeConcat ( parts ) {
    const flat = [];

    for ( const part of parts ) {
        if ( part.type === "fail" ) return failNode();
        if ( part.type === "empty" ) continue;

        if ( part.type === "concat" ) {
            flat.push( ...part.parts );
        }
        else {
            flat.push( part );
        }
    }

    if ( flat.length === 0 ) return emptyNode();
    if ( flat.length === 1 ) return flat[ 0 ];

    const merged = [];

    for ( const part of flat ) {
        const previous = merged[ merged.length - 1 ];

        if ( previous && previous.type === "literal" && part.type === "literal" ) {
            previous.value += part.value;
        }
        else {
            merged.push( part );
        }
    }

    if ( merged.length === 1 ) return merged[ 0 ];

    return { "type": "concat", "parts": merged };
}

function optimizeAlternation ( parts ) {
    const unique = [],
        seen = new Set();

    for ( const part of parts ) {
        if ( part.type === "fail" ) continue;

        const key = astKey( part );

        if ( !seen.has( key ) ) {
            seen.add( key );
            unique.push( part );
        }
    }

    if ( unique.length === 0 ) return failNode();
    if ( unique.length === 1 ) return unique[ 0 ];

    /*
     * Merge one-code-point literal alternatives.
     */
    const chars = [],
        other = [];

    for ( const part of unique ) {
        if ( isSingleDigitLiteralNode( part ) ) {
            chars.push( part.value );
        }
        else {
            other.push( part );
        }
    }

    if ( chars.length > 0 ) {
        other.unshift( classNode( uniqueChars( chars ) ) );
    }

    const epsilonIndex = other.findIndex( part => part.type === "empty" );

    if ( epsilonIndex !== -1 ) {
        const rest = other.filter( part => part.type !== "empty" );

        if ( rest.length === 1 ) {
            return optionalNode( rest[ 0 ] );
        }

        return optionalNode( alternationNode( rest ) );
    }

    if ( other.length === 1 ) return other[ 0 ];

    return {
        "type": "alternation",
        "parts": other,
    };
}

function isSingleDigitLiteralNode ( node ) {
    return node.type === "literal" && node.value.length === 1;
}

function astKey ( node ) {
    switch ( node.type ) {
        case "empty":
            return "E";

        case "fail":
            return "F";

        case "literal":
            return `L:${ node.value }`;

        case "class":
            return `C:${ node.chars.join( "" ) }`;

        case "optional":
            return `O(${ astKey( node.node ) })`;

        case "concat":
            return `N(${ node.parts.map( astKey ).join( "," ) })`;

        case "alternation":
            return `A(${ node.parts.map( astKey ).join( "," ) })`;

        default:
            throw new Error( `Unknown AST node: ${ node.type }` );
    }
}

function serializeRegexAst ( node ) {
    const cached = serializeCache.get( node );
    if ( cached !== undefined ) return cached;

    const result = serializeRegexAstUncached( node );
    serializeCache.set( node, result );
    return result;
}

function serializeRegexAstUncached ( node ) {
    switch ( node.type ) {
        case "empty":
            return "";

        case "fail":
            return "(?!)";

        case "literal":
            return node.value;

        case "class":
            return charsToCharacterClass( node.chars );

        case "optional":
            return `${ groupIfNeeded( node.node ) }?`;

        case "concat":
            return node.parts.map( serializeRegexAst ).join( "" );

        case "alternation":
            return `(?:${ node.parts.map( serializeRegexAst ).join( "|" ) })`;

        default:
            throw new Error( `Unknown AST node: ${ node.type }` );
    }
}

function groupIfNeeded ( node ) {
    if ( node.type === "literal" || node.type === "class" || node.type === "fail" ) {
        return serializeRegexAst( node );
    }

    if ( node.type === "empty" ) return "";

    return `(?:${ serializeRegexAst( node ) })`;
}

function charsToCharacterClass ( chars ) {
    const digits = [ ...new Set( chars.map( Number ) ) ].sort( ( a, b ) => a - b );

    if ( digits.length === 0 ) return "(?!)";

    if ( digits.length === 1 ) return String( digits[ 0 ] );

    const ranges = [];

    let from = digits[ 0 ],
        to = digits[ 0 ];

    for ( let i = 1; i < digits.length; i++ ) {
        const digit = digits[ i ];

        if ( digit === to + 1 ) {
            to = digit;
        }
        else {
            ranges.push( [ from, to ] );
            from = to = digit;
        }
    }

    ranges.push( [ from, to ] );

    if ( digits.length === 10 && digits.every( ( digit, i ) => digit === i ) ) {
        return "\\d";
    }

    let body = "";

    for ( const [ a, b ] of ranges ) {
        if ( a === b ) {
            body += a;
        }
        else if ( b === a + 1 ) {
            body += `${ a }${ b }`;
        }
        else {
            body += `${ a }-${ b }`;
        }
    }

    return `[${ body }]`;
}

function uniqueChars ( chars ) {
    return [ ...new Set( chars ) ];
}

function optimizeLiteralSet ( values ) {
    const unique = [ ...new Set( values.filter( value => value !== "" ) ) ];

    if ( unique.length === 0 ) return "(?!)";
    if ( unique.length === 1 ) return unique[ 0 ];

    /*
     * When every alternative is a same-length run of decimal digits, build
     * a minimal DFA — which shares both common prefixes AND common
     * suffixes — via the same DFA -> AST -> regex pipeline already used
     * for stepped ranges, instead of a plain prefix trie (which only
     * shares prefixes and can miss suffix-driven savings, e.g. values
     * that all end in the same digits due to a large step).
     */
    if ( isUniformDigitSet( unique ) ) {
        const dfa = buildLiteralTrieDfa( unique ),
            minimized = minimizeDfa( dfa ),
            ast = optimizeRegexAst( dfaToAst( minimized ) );

        return serializeRegexAst( ast );
    }

    /*
     * Otherwise (general literals, e.g. character-class alternatives, or
     * mixed-length fragments), fall back to a plain prefix trie.
     */
    if ( unique.every( isPlainLiteral ) ) {
        const root = createTrieNode();

        for ( const value of unique ) {
            insertTrie( root, value );
        }

        return trieToRegex( root );
    }

    return `(?:${ unique.join( "|" ) })`;
}

function isUniformDigitSet ( values ) {
    const width = values[ 0 ].length;

    return values.every( value => value.length === width && DIGITS_ONLY_REGEXP.test( value ) );
}

function buildLiteralTrieDfa ( values ) {
    const states = [ { "accepting": false, "transitions": new Map() } ];

    for ( const value of values ) {
        let stateId = 0;

        for ( const char of value ) {
            const digit = Number( char ),
                state = states[ stateId ];

            let nextId = state.transitions.get( digit );

            if ( nextId === undefined ) {
                nextId = states.length;
                states.push( { "accepting": false, "transitions": new Map() } );
                state.transitions.set( digit, nextId );
            }

            stateId = nextId;
        }

        states[ stateId ].accepting = true;
    }

    return { states, "start": 0 };
}

function isPlainLiteral ( value ) {
    return !/[\\^$.*+?\(\)\[\]\{\}\|\/]/v.test( value );
}

function createTrieNode () {
    return {
        "terminal": false,
        "children": new Map(),
    };
}

function insertTrie ( root, value ) {
    let node = root;

    for ( const char of value ) {
        let child = node.children.get( char );

        if ( !child ) {
            child = createTrieNode();
            node.children.set( char, child );
        }

        node = child;
    }

    node.terminal = true;
}

function trieToRegex ( node ) {
    const alternatives = [],
        terminalChars = [];

    for ( const [ char, child ] of node.children ) {
        if ( child.terminal && child.children.size === 0 ) {
            terminalChars.push( char );
        }
    }

    if ( terminalChars.length > 0 ) {
        alternatives.push( charsToCharacterClass( terminalChars ) );
    }

    for ( const [ char, child ] of node.children ) {
        if ( child.terminal && child.children.size === 0 ) {
            continue;
        }

        alternatives.push( char + trieToRegex( child ) );
    }

    if ( node.terminal ) {
        alternatives.push( "" );
    }

    if ( alternatives.length === 0 ) return "";
    if ( alternatives.length === 1 ) return alternatives[ 0 ];

    if ( alternatives.includes( "" ) ) {
        const nonEmpty = alternatives.filter( value => value !== "" );

        if ( nonEmpty.length === 1 ) {
            return `${ nonEmpty[ 0 ] }?`;
        }

        return `(?:${ nonEmpty.join( "|" ) })?`;
    }

    return `(?:${ alternatives.join( "|" ) })`;
}

function decimalPowers ( width ) {
    const powers = new Array( width + 1 );
    powers[ 0 ] = 1n;

    for ( let i = 1; i <= width; i++ ) {
        powers[ i ] = powers[ i - 1 ] * 10n;
    }

    return powers;
}

function bigintToDigits ( value, width ) {
    const raw = value.toString(),
        digits = new Array( width ),
        offset = width - raw.length;

    for ( let i = 0; i < offset; i++ ) {
        digits[ i ] = 0;
    }

    for ( let i = 0; i < raw.length; i++ ) {
        digits[ offset + i ] = Number( raw[ i ] );
    }

    return digits;
}

function wildcardDigits ( count ) {
    if ( count === 0 ) return "";
    if ( count === 1 ) return "\\d";

    return `\\d{${ count }}`;
}
