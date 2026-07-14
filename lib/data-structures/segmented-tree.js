import Range from "#lib/range";

export default class SegmentTree {
    #coordinates;
    #n;
    #tree;

    constructor ( ranges ) {
        ranges = ranges.map( range => Range.new( range ) ).filter( range => !range.isRelative );

        const coordinates = new Set();

        for ( const range of ranges ) {
            coordinates.add( range.start );
            coordinates.add( range.end );
        }

        this.#coordinates = [ ...coordinates ].sort( ( a, b ) => a - b );

        this.#n = this.#coordinates.length - 1;

        this.#tree = Array.from( { "length": 4 * this.#n }, () => [] );

        for ( const range of ranges ) {
            const qlIdx = this.#findCoordinateIndex( range.start ),
                qrIdx = this.#findCoordinateIndex( range.end );

            this.#insert( 1, 0, this.#n - 1, qlIdx, qrIdx, range );
        }
    }

    // public
    findRanges ( value ) {
        if ( value < this.#coordinates[ 0 ] || value >= this.#coordinates[ this.#n ] ) {
            return [];
        }

        let targetIdx = -1,
            left = 0,
            right = this.#n - 1;

        while ( left <= right ) {
            const middle = Math.floor( ( left + right ) / 2 );

            if ( value >= this.#coordinates[ middle ] && value < this.#coordinates[ middle + 1 ] ) {
                targetIdx = middle;

                break;
            }

            if ( value < this.#coordinates[ middle ] ) {
                right = middle - 1;
            }
            else {
                left = middle + 1;
            }
        }

        if ( targetIdx === -1 ) {
            return [];
        }
        else {
            return this.#findRanges( 1, 0, this.#n - 1, targetIdx );
        }
    }

    // private
    #insert ( node, left, right, qlIdx, qrIdx, range ) {
        if ( qlIdx > right || qrIdx < left || qlIdx >= qrIdx ) {
            return;
        }

        if ( left >= qlIdx && right < qrIdx ) {
            this.#tree[ node ].push( range );

            return;
        }

        const middle = Math.floor( ( left + right ) / 2 );

        if ( qlIdx <= middle ) {
            this.#insert( 2 * node, left, middle, qlIdx, qrIdx, range );
        }

        if ( qrIdx > middle + 1 ) {
            this.#insert( 2 * node + 1, middle + 1, right, qlIdx, qrIdx, range );
        }
    }

    #findRanges ( node, l, r, targetIdx, result = [] ) {
        if ( this.#tree[ node ].length > 0 ) {
            result.push( ...this.#tree[ node ] );
        }

        if ( l === r ) return result;

        const middle = Math.floor( ( l + r ) / 2 );

        if ( targetIdx <= middle ) {
            this.#findRanges( 2 * node, l, middle, targetIdx, result );
        }
        else {
            this.#findRanges( 2 * node + 1, middle + 1, r, targetIdx, result );
        }

        return result;
    }

    #findCoordinateIndex ( value ) {
        var left = 0,
            right = this.#n;

        while ( left <= right ) {
            const middle = Math.floor( ( left + right ) / 2 );

            if ( this.#coordinates[ middle ] === value ) {
                return middle;
            }

            if ( this.#coordinates[ middle ] < value ) {
                left = middle + 1;
            }
            else {
                right = middle - 1;
            }
        }

        return -1;
    }
}
