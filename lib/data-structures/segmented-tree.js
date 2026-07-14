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

    findIntersectingRanges ( range ) {
        const queryRange = Range.new( range );

        if ( queryRange.end <= this.#coordinates[ 0 ] || queryRange.start >= this.#coordinates[ this.#n ] ) {
            return [];
        }

        const qlIdx = this.#findLeftIndex( queryRange.start ),
            qrIdx = this.#findRightIndex( queryRange.end );

        if ( qlIdx >= qrIdx ) {
            return [];
        }

        const result = [];

        this.#findIntersecting( 1, 0, this.#n - 1, qlIdx, qrIdx, result );

        return [ ...new Set( result ) ];
    }

    findCoveringRanges ( range ) {
        const queryRange = Range.new( range ),
            qlIdx = this.#findLeftIndex( queryRange.start ),
            qrIdx = this.#findRightIndex( queryRange.end );

        if ( qlIdx >= qrIdx ) {
            return [];
        }

        const listsToIntersect = [];

        for ( let i = qlIdx; i < qrIdx; i++ ) {
            const currentIntervalResult = [];

            this.#collectRangesForInterval( 1, 0, this.#n - 1, i, currentIntervalResult );

            listsToIntersect.push( currentIntervalResult );
        }

        if ( listsToIntersect.length === 0 ) return [];

        let coveringRanges = listsToIntersect[ 0 ];

        for ( let i = 1; i < listsToIntersect.length; i++ ) {
            const currentSet = new Set( listsToIntersect[ i ] );

            coveringRanges = coveringRanges.filter( range => currentSet.has( range ) );
        }

        return coveringRanges.filter( range => range.start <= queryRange.start && range.end >= queryRange.end );
    }

    findCoveredRanges ( range ) {
        const queryRange = Range.new( range ),
            qlIdx = this.#findLeftIndex( queryRange.start ),
            qrIdx = this.#findRightIndex( queryRange.end );

        if ( qlIdx >= qrIdx ) {
            return [];
        }

        const result = [];

        this.#findCovered( 1, 0, this.#n - 1, qlIdx, qrIdx, result );

        return [ ...new Set( result ) ].filter( range => range.start >= queryRange.start && range.end <= queryRange.end );
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

    #findRanges ( node, left, right, targetIdx, result = [] ) {
        if ( this.#tree[ node ].length > 0 ) {
            result.push( ...this.#tree[ node ] );
        }

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
        if ( this.#tree[ node ].length > 0 ) {
            result.push( ...this.#tree[ node ] );
        }

        if ( left === right ) return;

        const middle = Math.floor( ( left + right ) / 2 );

        if ( qlIdx < middle + 1 ) {
            this.#findIntersecting( 2 * node, left, middle, qlIdx, qrIdx, result );
        }

        if ( qrIdx > middle + 1 ) {
            this.#findIntersecting( 2 * node + 1, middle + 1, right, qlIdx, qrIdx, result );
        }
    }

    #collectRangesForInterval ( node, left, right, targetIdx, result ) {
        if ( this.#tree[ node ].length > 0 ) {
            result.push( ...this.#tree[ node ] );
        }

        if ( left === right ) return;

        const middle = Math.floor( ( left + right ) / 2 );

        if ( targetIdx <= middle ) {
            this.#collectRangesForInterval( 2 * node, left, middle, targetIdx, result );
        }
        else {
            this.#collectRangesForInterval( 2 * node + 1, middle + 1, right, targetIdx, result );
        }
    }

    #findCovered ( node, left, right, qlIdx, qrIdx, result ) {
        if ( left > right || left >= qrIdx || right + 1 <= qlIdx ) {
            return;
        }

        if ( left >= qlIdx && right + 1 <= qrIdx ) {
            this.#collectAllSubtreeRanges( node, result );

            return;
        }

        if ( left === right ) return;

        const middle = Math.floor( ( left + right ) / 2 );

        this.#findCovered( 2 * node, left, middle, qlIdx, qrIdx, result );

        this.#findCovered( 2 * node + 1, middle + 1, right, qlIdx, qrIdx, result );
    }

    #collectAllSubtreeRanges ( node, result ) {
        if ( this.#tree[ node ] && this.#tree[ node ].length > 0 ) {
            result.push( ...this.#tree[ node ] );
        }

        if ( 2 * node < this.#tree.length ) {
            this.#collectAllSubtreeRanges( 2 * node, result );
        }

        if ( 2 * node + 1 < this.#tree.length ) {
            this.#collectAllSubtreeRanges( 2 * node + 1, result );
        }
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

    #findLeftIndex ( value ) {
        if ( value <= this.#coordinates[ 0 ] ) return 0;
        if ( value >= this.#coordinates[ this.#n ] ) return this.#n;

        var left = 0,
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

    #findRightIndex ( value ) {
        if ( value <= this.#coordinates[ 0 ] ) return 0;
        if ( value >= this.#coordinates[ this.#n ] ) return this.#n;

        var left = 0,
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
