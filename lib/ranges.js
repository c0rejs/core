import RandomValues from "#lib/crypto/random-values";
import AvlTree from "#lib/data-structures/avl-tree";
import Range from "#lib/range";

export default class Ranges {
    #ranges = [];
    #httpRange;
    #hasRelativeRanges = false;
    #maxLength = 0;
    #startAvlTree;
    #indexAvlTree;

    constructor ( ranges ) {
        if ( !Array.isArray( ranges ) ) ranges = [ ranges ];

        for ( let range of ranges ) {
            range = Range.new( range );

            this.#ranges.push( range );

            if ( range.isRelative ) {
                this.#hasRelativeRanges = true;
            }
            else if ( range.maxLength ) {
                this.#maxLength += range.maxLength;
            }
        }
    }

    // static
    static new ( ranges ) {
        if ( ranges instanceof this ) {
            return ranges;
        }
        else {
            return new this( ranges );
        }
    }

    // properties
    get size () {
        return this.#ranges.length;
    }

    get hasRanges () {
        return this.#ranges.length !== 0;
    }

    get hasRelativeRanges () {
        return this.#hasRelativeRanges;
    }

    get maxLength () {
        return this.#maxLength;
    }

    get isValidHttpRange () {
        return this.toHttpRange() != null;
    }

    // public
    createRanges ( { contentLength, start, end, ...options } = {} ) {
        const ranges = Array.from( this.#ranges, range => range.createRange( { contentLength, start, end, ...options } ) );

        return new this.constructor( ranges );
    }

    hasValue ( value ) {
        return this.findRange( value )
            ? true
            : false;
    }

    findRange ( value ) {
        if ( this.#hasRelativeRanges ) return;

        if ( !this.#startAvlTree ) {
            this.#startAvlTree = new AvlTree();

            for ( const range of this.#ranges ) {
                this.#startAvlTree.set( `${ range.start.toString().padStart( 16, "0" ) }-${ range.end.toString().padStart( 16, "0" ) }`, range );
            }
        }

        const nodes = [ this.#startAvlTree.root ];

        while ( nodes.length ) {
            const node = nodes.pop();

            // range >= node
            if ( value >= node.value.start ) {

                // range found
                if ( value <= node.value.end ) {
                    return node.value;
                }

                if ( node.right ) {
                    nodes.push( node.right );
                }

                // XXX skip, if ranges are not overlapped
                if ( node.left ) {
                    nodes.push( node.left );
                }
            }

            // range < node
            else {
                if ( node.left ) {
                    nodes.push( node.left );
                }
            }
        }
    }

    getRandomValue () {
        if ( !this.#indexAvlTree ) {
            if ( !this.#maxLength ) return;

            this.#indexAvlTree = new AvlTree();

            let start = 0;

            for ( const range of this.#ranges ) {
                if ( range.isRelative || !range.maxLength ) continue;

                this.#indexAvlTree.set( start, {
                    start,
                    "end": start + range.maxLength,
                    range,
                } );

                start += range.maxLength;
            }
        }

        var index = RandomValues.default.getRandomInt( 0, this.#maxLength - 1 ),
            node = this.#indexAvlTree.root;

        while ( node ) {
            if ( index >= node.value.start ) {

                // range found
                if ( index < node.value.end ) {
                    return {
                        "range": node.value.range,
                        "value": node.value.range.start + ( index - node.value.start ),
                    };
                }

                node = node.right;
            }
            else {
                node = node.left;
            }
        }
    }

    getRandomRange () {
        if ( this.#ranges.length === 0 ) {
            return;
        }
        else if ( this.#ranges.length === 1 ) {
            return this.#ranges[ 0 ];
        }
        else {
            return this.#ranges[ RandomValues.default.getRandomInt( 0, this.#ranges.length - 1 ) ];
        }
    }

    toHttpRange () {
        RANGE: if ( this.#httpRange === undefined ) {
            this.#httpRange = null;

            if ( !this.#ranges.length ) break RANGE;

            const ranges = [];

            for ( const range of this.#ranges ) {
                if ( !range.isValidHttpRange ) {
                    break RANGE;
                }

                ranges.push( range.toHttpRange() );
            }

            this.#httpRange = ranges.join( "," );
        }

        return this.#httpRange;
    }

    toRangeHeader () {
        if ( this.isValidHttpRange ) {
            return "bytes=" + this.toHttpRange();
        }
    }

    [ Symbol.iterator ] () {
        return this.#ranges.values();
    }

    [ Symbol.for( "nodejs.util.inspect.custom" ) ] ( depth, options, inspect ) {
        const spec = {
            "ranges": this.#ranges,
        };

        return `${ this.constructor.name }: ${ inspect( spec ) }`;
    }
}
