import RandomValues from "#lib/crypto/random-values";
import Range from "#lib/range";

const DEFAULT_BIT_STRENGTH = 70,
    randomValues = new RandomValues( 1024 );

export default class Alphabet {
    #name;
    #ranges = [];
    #tags;
    #size = 0;
    #charBitStrength;

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
    generateRandomChar () {
        return String.fromCodePoint( this.getRandomCodePoint() );
    }

    getRandomCodePoint () {
        return this._getCodePointAt( randomValues.getRandomInt( 0, this.#size ) );
    }

    generateRandomPassword ( { bitStrength = DEFAULT_BIT_STRENGTH, length } = {} ) {
        length ||= Math.ceil( bitStrength / this.#charBitStrength );

        const chars = [];

        for ( let n = 0; n < length; n++ ) {
            chars.push( this.generateRandomChar() );
        }

        return {
            "password": chars.join( "" ),
            "bitStrength": this.#charBitStrength * chars.length,
        };
    }

    hasCodePoint ( codePoint ) {
        if ( typeof codePoint === "string" ) {
            codePoint = codePoint.codePointAt( 0 );
        }

        for ( const range of this.#ranges ) {
            if ( codePoint >= range.start && codePoint < range.end ) {
                return true;
            }
        }

        return false;
    }

    [ Symbol.for( "nodejs.util.inspect.custom" ) ] ( depth, options, inspect ) {
        const spec = {
            "name": this.name,
            "size": this.size,
            "charBitStrength": this.charBitStrength,
        };

        return `${ this.constructor.name }: ${ inspect( spec ) }`;
    }

    // protected
    _getCodePointAt ( index ) {
        for ( const range of this.#ranges ) {
            if ( index < range.maxLength ) {
                return range.start + index;
            }

            index -= range.maxLength;
        }
    }
}
