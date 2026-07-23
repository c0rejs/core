import Range from "#lib/range";
import Ranges from "#lib/ranges";

export default class Alphabet {
    #name;
    #ranges;
    #size = 0;
    #charBitStrength;

    constructor ( name, ranges ) {
        this.#name = name;

        const preparedRanges = [];

        for ( let range of ranges ) {

            // Alphabet
            if ( range instanceof Alphabet ) {
                preparedRanges.push( ...range.ranges );
            }

            // Range
            else {
                range = Range.new( range );

                preparedRanges.push( range );
            }
        }

        this.#ranges = new Ranges( preparedRanges );

        this.#size = this.#ranges.maxLength;

        this.#charBitStrength = Math.log2( this.#size );
    }

    // properties
    get name () {
        return this.#name;
    }

    get ranges () {
        return this.#ranges;
    }

    get size () {
        return this.#size;
    }

    get charBitStrength () {
        return this.#charBitStrength;
    }

    // public
    hasCodePoint ( codePoint ) {
        if ( typeof codePoint === "string" ) {
            codePoint = codePoint.codePointAt( 0 );
        }

        return this.#ranges.hasRangesIntersecting( codePoint );
    }

    findRange ( codePoint ) {
        if ( typeof codePoint === "string" ) {
            codePoint = codePoint.codePointAt( 0 );
        }

        return this.#ranges.findRangesIntersecting( codePoint )[ 0 ];
    }

    getRandomChar () {
        return String.fromCodePoint( this.getRandomCodePoint() );
    }

    getRandomCodePoint () {
        return this.#ranges.getRandomValue();
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
