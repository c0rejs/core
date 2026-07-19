import Range from "#lib/range";
import { compare } from "#lib/utils";

export default class SegmentTree {
    #coordinates;
    #n;
    #tree;
    #subtreeRanges;

    constructor ( ranges ) {
        ranges = ranges.map( range => Range.new( range ) ).filter( range => !range.isRelativeRange );

        const coordinates = new Set();

        for ( const range of ranges ) {
            coordinates.add( range.start );
            coordinates.add( range.end );
        }

        this.#coordinates = [ ...coordinates ].sort( compare );

        this.#n = Math.max( this.#coordinates.length - 1, 0 );

        // lazily-populated buckets: most nodes never store a range, so avoid
        // allocating 4n arrays up front and only create one when first needed.
        this.#tree = new Array( 4 * this.#n ).fill( null );

        for ( const range of ranges ) {
            const qlIdx = this.#findCoordinateIndex( range.start ),
                qrIdx = this.#findCoordinateIndex( range.end );

            if ( qlIdx === -1 || qrIdx === -1 || qlIdx >= qrIdx ) continue;

            this.#insert( qlIdx, qrIdx, range );
        }

        this.#buildSubtreeRanges();
    }

    // public
    findRanges ( value ) {
        const targetIdx = this.#findElementaryIndex( value );

        if ( targetIdx === -1 ) return [];

        return this.#findRanges( 1, 0, this.#n - 1, targetIdx );
    }

    findIntersectingRanges ( range ) {
        const queryRange = Range.new( range );

        if ( this.#n === 0 || queryRange.end <= this.#coordinates[ 0 ] || queryRange.start >= this.#coordinates[ this.#n ] ) {
            return [];
        }

        const qlIdx = this.#lowerBound( queryRange.start ),
            qrIdx = this.#upperBound( queryRange.end );

        if ( qlIdx >= qrIdx ) return [];

        const result = new Set();

        this.#findIntersecting( 1, 0, this.#n - 1, qlIdx, qrIdx, result );

        return [ ...result ];
    }

    findCoveringRanges ( range ) {
        const queryRange = Range.new( range ),
            qlIdx = this.#lowerBound( queryRange.start ),
            qrIdx = this.#upperBound( queryRange.end );

        if ( qlIdx >= qrIdx ) return [];

        const canonicalNodes = [];

        this.#decompose( 1, 0, this.#n - 1, qlIdx, qrIdx, canonicalNodes );

        if ( canonicalNodes.length === 0 ) return [];

        let covering = null;

        for ( const node of canonicalNodes ) {
            covering = this.#collectAncestorRanges( node, covering );

            // nothing survives further intersection once it's empty
            if ( covering.size === 0 ) break;
        }

        return [ ...covering ].filter( range => range.start <= queryRange.start && range.end >= queryRange.end );
    }

    findCoveredRanges ( range ) {
        const queryRange = Range.new( range ),
            qlIdx = this.#lowerBound( queryRange.start ),
            qrIdx = this.#upperBound( queryRange.end );

        if ( qlIdx >= qrIdx ) return [];

        const result = new Set();

        this.#findCovered( 1, 0, this.#n - 1, qlIdx, qrIdx, result );

        return [ ...result ].filter( range => range.start >= queryRange.start && range.end <= queryRange.end );
    }

    // private
    #decompose ( node, left, right, qlIdx, qrIdx, canonicalNodes ) {
        if ( qlIdx > right || qrIdx <= left ) return;

        if ( left >= qlIdx && right < qrIdx ) {
            canonicalNodes.push( node );

            return;
        }

        if ( left === right ) return;

        const middle = Math.floor( ( left + right ) / 2 );

        if ( qlIdx <= middle ) this.#decompose( 2 * node, left, middle, qlIdx, qrIdx, canonicalNodes );
        if ( qrIdx > middle + 1 ) this.#decompose( 2 * node + 1, middle + 1, right, qlIdx, qrIdx, canonicalNodes );
    }

    #insert ( qlIdx, qrIdx, range ) {
        const canonicalNodes = [];

        this.#decompose( 1, 0, this.#n - 1, qlIdx, qrIdx, canonicalNodes );

        for ( const node of canonicalNodes ) {
            ( this.#tree[ node ] ??= [] ).push( range );
        }
    }

    #buildSubtreeRanges () {
        this.#subtreeRanges = new Array( this.#tree.length ).fill( null );

        for ( let node = this.#tree.length - 1; node >= 1; node-- ) {
            const own = this.#tree[ node ],
                left = 2 * node,
                right = 2 * node + 1,
                leftSet = left < this.#tree.length
                    ? this.#subtreeRanges[ left ]
                    : null,
                rightSet = right < this.#tree.length
                    ? this.#subtreeRanges[ right ]
                    : null;

            if ( !own && !leftSet && !rightSet ) continue; // stays null

            if ( !own && leftSet && !rightSet ) {
                this.#subtreeRanges[ node ] = leftSet;

                continue;
            }

            if ( !own && rightSet && !leftSet ) {
                this.#subtreeRanges[ node ] = rightSet;

                continue;
            }

            const set = new Set( own );

            if ( leftSet ) for ( const range of leftSet ) set.add( range );
            if ( rightSet ) for ( const range of rightSet ) set.add( range );

            this.#subtreeRanges[ node ] = set;
        }
    }

    #findRanges ( node, left, right, targetIdx, result = [] ) {
        const bucket = this.#tree[ node ];

        if ( bucket ) result.push( ...bucket );

        if ( left === right ) return result;

        const middle = Math.floor( ( left + right ) / 2 );

        if ( targetIdx <= middle ) {
            this.#findRanges( 2 * node, left, middle, targetIdx, result );
        }
        else {
            this.#findRanges( 2 * node + 1, middle + 1, right, targetIdx, result );
        }

        return result;
    }

    #findIntersecting ( node, left, right, qlIdx, qrIdx, result ) {
        const bucket = this.#tree[ node ];

        if ( bucket ) {
            for ( const range of bucket ) result.add( range );
        }

        if ( left === right ) return;

        const middle = Math.floor( ( left + right ) / 2 );

        if ( qlIdx <= middle ) {
            this.#findIntersecting( 2 * node, left, middle, qlIdx, qrIdx, result );
        }

        if ( qrIdx > middle + 1 ) {
            this.#findIntersecting( 2 * node + 1, middle + 1, right, qlIdx, qrIdx, result );
        }
    }

    #collectAncestorRanges ( node, filterSet ) {
        const result = new Set();

        while ( node >= 1 ) {
            const bucket = this.#tree[ node ];

            if ( bucket ) {
                for ( const range of bucket ) {
                    if ( !filterSet || filterSet.has( range ) ) result.add( range );
                }
            }

            node >>= 1;
        }

        return result;
    }

    #findCovered ( node, left, right, qlIdx, qrIdx, result ) {

        // no overlap between node's [left, right] and the half-open [qlIdx, qrIdx)
        if ( left > right || left >= qrIdx || right < qlIdx ) {
            return;
        }

        if ( left >= qlIdx && right < qrIdx ) {
            const subtree = this.#subtreeRanges[ node ];

            if ( subtree ) {
                for ( const range of subtree ) result.add( range );
            }

            return;
        }

        if ( left === right ) return;

        const middle = Math.floor( ( left + right ) / 2 );

        this.#findCovered( 2 * node, left, middle, qlIdx, qrIdx, result );
        this.#findCovered( 2 * node + 1, middle + 1, right, qlIdx, qrIdx, result );
    }

    #findElementaryIndex ( value ) {
        if ( this.#n === 0 || value < this.#coordinates[ 0 ] || value >= this.#coordinates[ this.#n ] ) {
            return -1;
        }

        let left = 0,
            right = this.#n - 1;

        while ( left <= right ) {
            const middle = Math.floor( ( left + right ) / 2 );

            if ( value >= this.#coordinates[ middle ] && value < this.#coordinates[ middle + 1 ] ) {
                return middle;
            }

            if ( value < this.#coordinates[ middle ] ) {
                right = middle - 1;
            }
            else {
                left = middle + 1;
            }
        }

        return -1;
    }

    #findCoordinateIndex ( value ) {
        let left = 0,
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

    #lowerBound ( value ) {
        if ( this.#n === 0 || value <= this.#coordinates[ 0 ] ) return 0;
        if ( value >= this.#coordinates[ this.#n ] ) return this.#n;

        let left = 0,
            right = this.#n;

        while ( left < right ) {
            const middle = Math.floor( ( left + right ) / 2 );

            if ( this.#coordinates[ middle + 1 ] > value ) {
                right = middle;
            }
            else {
                left = middle + 1;
            }
        }

        return left;
    }

    #upperBound ( value ) {
        if ( this.#n === 0 || value <= this.#coordinates[ 0 ] ) return 0;
        if ( value >= this.#coordinates[ this.#n ] ) return this.#n;

        let left = 0,
            right = this.#n;

        while ( left < right ) {
            const middle = Math.floor( ( left + right ) / 2 );

            if ( this.#coordinates[ middle ] >= value ) {
                right = middle;
            }
            else {
                left = middle + 1;
            }
        }

        return left;
    }
}
