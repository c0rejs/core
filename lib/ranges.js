import Range from "#lib/range";

export default class Ranges {
    #ranges = [];
    #httpRange;

    constructor ( ranges ) {
        if ( !Array.isArray( ranges ) ) ranges = [ ranges ];

        for ( let range of ranges ) {
            range = Range.new( range );

            this.#ranges.push( range );
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

    get isValidHttpRange () {
        return this.toHttpRange() != null;
    }

    // public
    createRanges ( { contentLength, start, end, ...options } = {} ) {
        const ranges = [];

        for ( const range of this.#ranges ) {
            ranges.push( range.createRange( { contentLength, start, end, ...options } ) );
        }

        return new this.constructor( ranges );
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
