import { compare } from "#lib/utils";
import AvlTreeNode from "./avl-tree/node.js";

export default class AvlTree {
    #comparator;
    #index = new Set();
    #root;

    constructor ( { comparator } = {} ) {
        this.#comparator = comparator || compare;
    }

    // properties
    get comparator () {
        return this.#comparator;
    }

    get size () {
        return this.#index.size;
    }

    get isEmpty () {
        return !this.#root;
    }

    get root () {
        return this.#root;
    }

    get firstNode () {
        var node = this.#root;

        if ( node ) {
            while ( node.left ) node = node.left;
        }

        return node;
    }

    get lastNode () {
        var node = this.#root;

        if ( node ) {
            while ( node.right ) node = node.right;
        }

        return node;
    }

    // public
    has ( key ) {
        return this.#index.has( key );
    }

    get ( key ) {
        return this.#get( key );
    }

    set ( key, value ) {
        if ( Array.isArray( key ) ) {
            key = Object.fromEntries( key );
        }

        if ( typeof key === "object" ) {
            const nodes = key;

            if ( this.size ) {
                for ( const key in nodes ) {
                    this.#set( key, nodes[ key ] );
                }
            }
            else {
                const entries = Object.entries( key ),
                    size = entries.length;

                // pre-sort, faster for large trees
                this.#sort( entries, 0, size - 1, this.#comparator );

                this.#root = this.#load( null, entries, 0, size );

                this.#markBalance( this.#root );
            }
        }
        else {
            this.#set( key, value );
        }

        return this;
    }

    delete ( key ) {
        var node = this.#get( key );

        if ( node ) {
            this.#index.delete( key );

            var max, min;

            if ( node.left ) {
                max = node.left;

                while ( max.left || max.right ) {
                    while ( max.right ) {
                        max = max.right;
                    }

                    node.setKey( max.key );
                    node.value = max.value;

                    if ( max.left ) {
                        node = max;
                        max = max.left;
                    }
                }

                node.setKey( max.key );
                node.value = max.value;
                node = max;
            }

            if ( node.right ) {
                min = node.right;

                while ( min.left || min.right ) {
                    while ( min.left ) {
                        min = min.left;
                    }

                    node.setKey( min.key );
                    node.value = min.value;

                    if ( min.right ) {
                        node = min;
                        min = min.right;
                    }
                }

                node.setKey( min.key );
                node.value = min.value;
                node = min;
            }

            var parent = node.parent,
                pp = node,
                newRoot;

            while ( parent ) {
                if ( parent.left === pp ) {
                    parent.addBalanceFactor( -1 );
                }
                else {
                    parent.addBalanceFactor( 1 );
                }

                if ( parent.balanceFactor < -1 ) {
                    if ( parent.right.balanceFactor === 1 ) {
                        this.#rotateRight( parent.right );
                    }

                    newRoot = this.#rotateLeft( parent );

                    if ( parent === this.#root ) {
                        this.#root = newRoot;
                    }

                    parent = newRoot;
                }
                else if ( parent.balanceFactor > 1 ) {
                    if ( parent.left.balanceFactor === -1 ) {
                        this.#rotateLeft( parent.left );
                    }

                    newRoot = this.#rotateRight( parent );

                    if ( parent === this.#root ) {
                        this.#root = newRoot;
                    }

                    parent = newRoot;
                }

                if ( parent.balanceFactor === -1 || parent.balanceFactor === 1 ) {
                    break;
                }

                pp = parent;
                parent = parent.parent;
            }

            if ( node.parent ) {
                if ( node.parent.left === node ) {
                    node.parent.setLeft( null );
                }
                else {
                    node.parent.setRight( null );
                }
            }

            if ( node === this.#root ) {
                this.#root = null;
            }
        }

        return this;
    }

    clear () {
        this.#index.clear();
        this.#root = null;

        return this;
    }

    keys () {
        const keys = Array.from( this, node => node.key );

        return keys;
    }

    values () {
        const values = Array.from( this, node => node.value );

        return values;
    }

    entries () {
        const entries = Array.from( this, node => [ node.key, node.value ] );

        return entries;
    }

    toString ( printNode = n => n.key ) {
        const out = [];

        this.#row( this.#root, null, true, string => out.push( string ), printNode );

        return out.join( "" );
    }

    toJSON () {
        return this.entries();
    }

    * [ Symbol.iterator ] () {
        var node = this.#root,
            stack = [];

        while ( true ) {
            if ( node ) {
                stack.push( node );

                node = node.left;
            }
            else {
                if ( stack.length > 0 ) {
                    node = stack.pop();

                    yield node;

                    node = node.right;
                }
                else {
                    break;
                }
            }
        }
    }

    [ Symbol.for( "nodejs.util.inspect.custom" ) ] ( depth, options, inspect ) {
        const spec = {
            "size": this.size,
        };

        return `${ this.constructor.name }: ${ inspect( spec ) }`;
    }

    // private
    #get ( key ) {
        if ( this.#index.has( key ) ) {
            const compare = this.#comparator;

            var node = this.#root,
                cmp;

            while ( node ) {
                cmp = compare( key, node.key );

                if ( cmp === 0 ) {
                    return node;
                }
                else if ( cmp < 0 ) {
                    node = node.left;
                }
                else {
                    node = node.right;
                }
            }
        }
    }

    #set ( key, value ) {
        if ( !this.#root ) {
            this.#root = new AvlTreeNode( {
                key,
                value,
                "parent": null,
                "left": null,
                "right": null,
                "balanceFactor": 0,
            } );

            this.#index.add( key );

            return;
        }

        var compare = this.#comparator,
            cmp,
            node = this.#root,
            parent = null;

        // find parent node
        while ( node ) {
            cmp = compare( key, node.key );

            parent = node;

            if ( cmp === 0 ) {
                node.value = value;

                return;
            }
            else if ( cmp < 0 ) {
                node = node.left;
            }
            else {
                node = node.right;
            }
        }

        var newNode = new AvlTreeNode( {
                key,
                value,
                parent,
                "left": null,
                "right": null,
                "balanceFactor": 0,
            } ),
            newRoot;

        this.#index.add( key );

        if ( cmp <= 0 ) {
            parent.setLeft( newNode );
        }
        else {
            parent.setRight( newNode );
        }

        while ( parent ) {
            cmp = compare( parent.key, key );

            if ( cmp < 0 ) {
                parent.addBalanceFactor( -1 );
            }
            else {
                parent.addBalanceFactor( 1 );
            }

            if ( parent.balanceFactor === 0 ) {
                break;
            }
            else if ( parent.balanceFactor < -1 ) {
                if ( parent.right.balanceFactor === 1 ) this.#rotateRight( parent.right );

                newRoot = this.#rotateLeft( parent );

                if ( parent === this.#root ) this.#root = newRoot;

                break;
            }
            else if ( parent.balanceFactor > 1 ) {
                if ( parent.left.balanceFactor === -1 ) this.#rotateLeft( parent.left );

                newRoot = this.#rotateRight( parent );

                if ( parent === this.#root ) this.#root = newRoot;

                break;
            }

            parent = parent.parent;
        }
    }

    #load ( parent, entries, start, end ) {
        const size = end - start;

        if ( size > 0 ) {
            const middle = start + Math.floor( size / 2 ),
                [ key, value ] = entries[ middle ],
                node = new AvlTreeNode( {
                    key,
                    value,
                    parent,
                } );

            node.setLeft( this.#load( node, entries, start, middle ) );
            node.setRight( this.#load( node, entries, middle + 1, end ) );

            this.#index.add( key );

            return node;
        }
    }

    #sort ( entries, left, right, compare ) {
        if ( left >= right ) return;

        const pivot = entries[ ( left + right ) >> 1 ][ 0 ];

        let i = left - 1,
            j = right + 1;

        while ( true ) {
            do {
                i++;
            } while ( compare( entries[ i ][ 0 ], pivot ) < 0 );

            do {
                j--;
            } while ( compare( entries[ j ][ 0 ], pivot ) > 0 );

            if ( i >= j ) break;

            const tmp = entries[ i ];
            entries[ i ] = entries[ j ];
            entries[ j ] = tmp;
        }

        this.#sort( entries, left, j, compare );

        this.#sort( entries, j + 1, right, compare );
    }

    #row ( root, prefix, isTail, out, printNode ) {
        if ( !root ) return;

        var indent;

        if ( prefix == null ) {
            out( `${ printNode( root ) }\n` );

            indent = isTail
                ? ""
                : "│";
        }
        else {
            out( `${ prefix }${ isTail
                ? "└─ "
                : "├─ " }${ printNode( root ) }\n` );

            indent = prefix + ( isTail
                ? "   "
                : "│  " );
        }

        if ( root.left ) this.#row( root.left, indent, !root.right, out, printNode );

        if ( root.right ) this.#row( root.right, indent, true, out, printNode );
    }

    #getSubtreeHeight ( node ) {
        return node
            ? 1 + Math.max( this.#getSubtreeHeight( node.left ), this.#getSubtreeHeight( node.right ) )
            : 0;
    }

    #isBalanced ( node ) {
        if ( !node ) {
            return true;
        }
        else {
            const lh = this.#getSubtreeHeight( node.left ),
                rh = this.#getSubtreeHeight( node.right );

            if ( Math.abs( lh - rh ) <= 1 && this.#isBalanced( node.left ) && this.#isBalanced( node.right ) ) {
                return true;
            }
            else {
                return false;
            }
        }
    }

    #markBalance ( node ) {
        if ( !node ) {
            return 0;
        }
        else {
            const lh = this.#markBalance( node.left ),
                rh = this.#markBalance( node.right );

            node.setBalanceFactor( lh - rh );

            return Math.max( lh, rh ) + 1;
        }
    }

    #rotateLeft ( node ) {
        var rightNode = node.right;
        node.setRight( rightNode.left );

        if ( rightNode.left ) rightNode.left.setParent( node );

        rightNode.setParent( node.parent );
        if ( rightNode.parent ) {
            if ( rightNode.parent.left === node ) {
                rightNode.parent.setLeft( rightNode );
            }
            else {
                rightNode.parent.setRight( rightNode );
            }
        }

        node.setParent( rightNode );
        rightNode.setLeft( node );

        node.addBalanceFactor( 1 );
        if ( rightNode.balanceFactor < 0 ) {
            node.addBalanceFactor( -rightNode.balanceFactor );
        }

        rightNode.addBalanceFactor( 1 );
        if ( node.balanceFactor > 0 ) {
            rightNode.addBalanceFactor( node.balanceFactor );
        }

        return rightNode;
    }

    #rotateRight ( node ) {
        var leftNode = node.left;
        node.setLeft( leftNode.right );
        if ( node.left ) node.left.setParent( node );

        leftNode.setParent( node.parent );
        if ( leftNode.parent ) {
            if ( leftNode.parent.left === node ) {
                leftNode.parent.setLeft( leftNode );
            }
            else {
                leftNode.parent.setRight( leftNode );
            }
        }

        node.setParent( leftNode );
        leftNode.setRight( node );

        node.addBalanceFactor( -1 );
        if ( leftNode.balanceFactor > 0 ) {
            node.addBalanceFactor( -leftNode.balanceFactor );
        }

        leftNode.addBalanceFactor( -1 );
        if ( node.balanceFactor < 0 ) {
            leftNode.addBalanceFactor( node.balanceFactor );
        }

        return leftNode;
    }
}
