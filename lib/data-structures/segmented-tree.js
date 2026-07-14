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
            const mid = Math.floor( ( left + right ) / 2 );

            if ( value >= this.#coordinates[ mid ] && value < this.#coordinates[ mid + 1 ] ) {
                targetIdx = mid;

                break;
            }

            if ( value < this.#coordinates[ mid ] ) {
                right = mid - 1;
            }
            else {
                left = mid + 1;
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
    #insert ( node, l, r, qlIdx, qrIdx, range ) {
        if ( qlIdx > r || qrIdx < l || qlIdx >= qrIdx ) {
            return;
        }

        if ( l >= qlIdx && r < qrIdx ) {
            this.#tree[ node ].push( range );

            return;
        }

        const mid = Math.floor( ( l + r ) / 2 );

        if ( qlIdx <= mid ) {
            this.#insert( 2 * node, l, mid, qlIdx, qrIdx, range );
        }

        if ( qrIdx > mid + 1 ) {
            this.#insert( 2 * node + 1, mid + 1, r, qlIdx, qrIdx, range );
        }
    }

    #findRanges ( node, l, r, targetIdx, result = [] ) {
        if ( this.#tree[ node ].length > 0 ) {
            result.push( ...this.#tree[ node ] );
        }

        if ( l === r ) return result;

        const mid = Math.floor( ( l + r ) / 2 );

        if ( targetIdx <= mid ) {
            this.#findRanges( 2 * node, l, mid, targetIdx, result );
        }
        else {
            this.#findRanges( 2 * node + 1, mid + 1, r, targetIdx, result );
        }

        return result;
    }

    #findCoordinateIndex ( value ) {
        var left = 0,
            right = this.#n;

        while ( left <= right ) {
            const mid = Math.floor( ( left + right ) / 2 );

            if ( this.#coordinates[ mid ] === value ) {
                return mid;
            }

            if ( this.#coordinates[ mid ] < value ) {
                left = mid + 1;
            }
            else {
                right = mid - 1;
            }
        }

        return -1;
    }
}
