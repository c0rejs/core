import AvlTree, { AvlNode } from "#lib/data-structures/avl-tree";
import Range from "#lib/range";
import { compare } from "#lib/utils";

function rangesCompare ( a, b ) {
    return compare( a.start, b.start ) || compare( a.inclusiveEndPoint, b.inclusiveEndPoint );
}

export class IntervalNode extends AvlNode {
    #max;

    constructor ( key, value ) {
        super( key, value );

        this.setMax( key.inclusiveEndPoint );
    }

    // properties
    get max () {
        return this.#max;
    }

    // public
    setMax ( max ) {
        this.#max = max;

        return this;
    }
}

export default class IntervalTree extends AvlTree {
    constructor () {
        super( {
            "compare": rangesCompare,
        } );
    }

    // public
    has ( range ) {
        range = Range.new( range );

        return super.has( range );
    }

    get ( range ) {
        range = Range.new( range );

        return super.get( range );
    }

    add ( range ) {
        range = Range.new( range );

        if ( range.isRelativeRange ) throw new Error( "Relative ranges are not supported" );

        return super.set( range, range );
    }

    set ( range, value ) {
        range = Range.new( range );

        if ( range.isRelativeRange ) throw new Error( "Relative ranges are not supported" );

        return super.set( range, value );
    }

    delete ( range ) {
        range = Range.new( range );

        return super.delete( range );
    }

    hasRangesIntersecting ( range ) {
        range = this.#normalizeRange( range );

        const start = range.start;

        let node = this.root;

        while ( node ) {
            if ( range.intersects( node.key ) ) {
                return true;
            }

            if ( node.left && compare( node.left.max, start ) >= 0 ) {
                node = node.left;
            }
            else {
                node = node.right;
            }
        }

        return false;
    }

    hasRangesContaining ( range ) {
        range = this.#normalizeRange( range );

        const start = range.start,
            end = range.inclusiveEndPoint,
            nodes = [];

        let current = this.root;

        while ( current || nodes.length ) {
            while ( current ) {
                nodes.push( current );

                current = current.left && compare( current.left.max, end ) >= 0
                    ? current.left
                    : null;
            }

            const node = nodes.pop();

            if ( node.key.contains( range ) ) {
                return true;
            }

            current = node.right && compare( node.key.start, start ) <= 0 && compare( node.right.max, end ) >= 0
                ? node.right
                : null;
        }

        return false;
    }

    hasRangesCoveredBy ( range ) {
        range = this.#normalizeRange( range );

        const start = range.start,
            end = range.inclusiveEndPoint,
            nodes = [];

        let current = this.root;

        while ( current || nodes.length ) {
            while ( current ) {
                nodes.push( current );

                current = compare( current.key.start, start ) >= 0
                    ? current.left
                    : null;
            }

            const node = nodes.pop();

            if ( node.key.isCoveredBy( range ) ) {
                return true;
            }

            current = compare( node.key.start, end ) <= 0
                ? node.right
                : null;
        }

        return false;
    }

    findRangesIntersecting ( range ) {
        range = this.#normalizeRange( range );

        const start = range.start,
            end = range.inclusiveEndPoint,
            result = [],
            nodes = [];

        let current = this.root;

        while ( current || nodes.length ) {
            while ( current ) {
                nodes.push( current );

                current = current.left && compare( current.left.max, start ) >= 0
                    ? current.left
                    : null;
            }

            const node = nodes.pop();

            if ( range.intersects( node.key ) ) {
                result.push( node.value );
            }

            current = node.right && compare( node.key.start, end ) <= 0 && compare( node.right.max, start ) >= 0
                ? node.right
                : null;
        }

        return result;
    }

    findRangesContaining ( range ) {
        range = this.#normalizeRange( range );

        const start = range.start,
            end = range.inclusiveEndPoint,
            result = [],
            nodes = [];

        let current = this.root;

        while ( current || nodes.length ) {
            while ( current ) {
                nodes.push( current );

                current = current.left && compare( current.left.max, end ) >= 0
                    ? current.left
                    : null;
            }

            const node = nodes.pop();

            if ( node.key.contains( range ) ) {
                result.push( node.value );
            }

            current = node.right && compare( node.key.start, start ) <= 0 && compare( node.right.max, end ) >= 0
                ? node.right
                : null;
        }

        return result;
    }

    findRangesCoveredBy ( range ) {
        range = this.#normalizeRange( range );

        const start = range.start,
            end = range.inclusiveEndPoint,
            result = [],
            nodes = [];

        let current = this.root;

        while ( current || nodes.length ) {
            while ( current ) {
                nodes.push( current );

                current = compare( current.key.start, start ) >= 0
                    ? current.left
                    : null;
            }

            const node = nodes.pop();

            if ( node.key.isCoveredBy( range ) ) {
                result.push( node.value );
            }

            current = compare( node.key.start, end ) <= 0
                ? node.right
                : null;
        }

        return result;
    }

    // protected
    _createNode ( key, value ) {
        return new IntervalNode( key, value );
    }

    _updateHeight ( node ) {
        super._updateHeight( node );

        let max = node.key.inclusiveEndPoint;

        if ( node.left && compare( node.left.max, max ) > 0 ) {
            max = node.left.max;
        }

        if ( node.right && compare( node.right.max, max ) > 0 ) {
            max = node.right.max;
        }

        node.setMax( max );
    }

    // private
    #normalizeRange ( range ) {
        if ( typeof range === "number" ) {
            range = new Range( {
                "start": range,
                "end": range,
                "inclusive": true,
            } );
        }
        else if ( typeof range === "bigint" ) {
            range = new Range( {
                "start": range,
                "end": range,
                "inclusive": true,
                "useBigInt": true,
            } );
        }
        else {
            range = Range.new( range );
        }

        return range;
    }
}
