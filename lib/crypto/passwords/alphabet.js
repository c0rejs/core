import RandomValues from "#lib/crypto/random-values";
import AvlTree from "#lib/data-structures/avl-tree";
import Range from "#lib/range";

const randomValues = new RandomValues( 1024 );

export default class Alphabet {
    #name;
    #ranges = [];
    #tags;
    #size = 0;
    #charBitStrength;
    #startAvlTree;
    #indexAvlTree;

    constructor ( name, ranges, { tags } = {} ) {
        this.#name = name;
        this.#tags = new Set( tags );

        for ( let range of ranges ) {

            // Alphabet
            if ( range instanceof Alphabet ) {
                this.#ranges.push( ...range.ranges );

                this.#size += range.size;
            }

            // Range
            else {
                range = Range.new( range );

                this.#ranges.push( range );

                this.#size += range.maxLength;
            }
        }

        this.#charBitStrength = Math.log2( this.#size );
    }

    // properties
    get name () {
        return this.#name;
    }

    get tags () {
        return this.#tags;
    }

    get ranges () {
        return this.#ranges.values();
    }

    get size () {
        return this.#size;
    }

    get charBitStrength () {
        return this.#charBitStrength;
    }

    // public
    hasCodePoint ( codePoint ) {
        if ( !this.#startAvlTree ) {
            this.#startAvlTree = new AvlTree();

            for ( const range of this.#ranges ) {
                this.#startAvlTree.set( range.start, range );
            }
        }

        if ( typeof codePoint === "string" ) {
            codePoint = codePoint.codePointAt( 0 );
        }

        var node = this.#startAvlTree.root;

        while ( node ) {
            if ( codePoint >= node.value.start ) {

                // range found
                if ( codePoint < node.value.end ) {
                    return true;
                }

                node = node.right;
            }
            else {
                node = node.left;
            }
        }

        return false;
    }

    getRandomCodePoint () {
        if ( !this.#indexAvlTree ) {
            this.#indexAvlTree = new AvlTree();

            var start = 0;

            for ( const range of this.#ranges ) {
                this.#indexAvlTree.set( start, {
                    start,
                    "end": start + range.maxLength,
                    range,
                } );

                start += range.maxLength;
            }
        }

        var index = randomValues.getRandomInt( 0, this.#size - 1 ),
            node = this.#indexAvlTree.root;

        while ( node ) {
            if ( index >= node.value.start ) {

                // range found
                if ( index < node.value.end ) {
                    return node.value.range.start + ( index - node.value.start );
                }

                node = node.right;
            }
            else {
                node = node.left;
            }
        }
    }

    generateRandomChar () {
        return String.fromCodePoint( this.getRandomCodePoint() );
    }

    [ Symbol.for( "nodejs.util.inspect.custom" ) ] ( depth, options, inspect ) {
        const spec = {
            "name": this.name,
            "size": this.size,
            "charBitStrength": this.charBitStrength,
        };

        return `${ this.constructor.name }: ${ inspect( spec ) }`;
    }
}
