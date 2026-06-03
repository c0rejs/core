export default class AvlTreeNode {
    #key;
    #value;
    #parent;
    #left;
    #right;
    #balanceFactor;

    constructor ( { key, value, parent, left, right, balanceFactor } = {} ) {
        this.#key = key;
        this.#value = value;
        this.#parent = parent;
        this.#left = left;
        this.#right = right;
        this.#balanceFactor = balanceFactor;
    }

    // properties
    get key () {
        return this.#key;
    }

    get value () {
        return this.#value;
    }

    set value ( value ) {
        this.#value = value;
    }

    get parent () {
        return this.#parent;
    }

    get left () {
        return this.#left;
    }

    get right () {
        return this.#right;
    }

    get balanceFactor () {
        return this.#balanceFactor;
    }

    get next () {
        var node = this,
            successor = node;

        if ( successor.right ) {
            successor = successor.right;

            while ( successor.left ) successor = successor.left;
        }
        else {
            successor = node.parent;

            while ( successor && successor.right === node ) {
                node = successor;

                successor = successor.parent;
            }
        }

        return successor;
    }

    get previous () {
        var node = this,
            predecessor = node;

        if ( predecessor.left ) {
            predecessor = predecessor.left;

            while ( predecessor.right ) predecessor = predecessor.right;
        }
        else {
            predecessor = node.parent;

            while ( predecessor && predecessor.left === node ) {
                node = predecessor;

                predecessor = predecessor.parent;
            }
        }

        return predecessor;
    }

    // public
    setKey ( value ) {
        this.#key = value;

        return this;
    }

    setParent ( value ) {
        this.#parent = value;

        return this;
    }

    setLeft ( value ) {
        this.#left = value;

        return this;
    }

    setRight ( value ) {
        this.#right = value;

        return this;
    }

    setBalanceFactor ( value ) {
        this.#balanceFactor = value;

        return this;
    }

    addBalanceFactor ( value ) {
        this.#balanceFactor += value;

        return this;
    }

    toString () {
        return this.#key;
    }

    toJSON () {
        return [ this.#key, this.#value ];
    }

    [ Symbol.for( "nodejs.util.inspect.custom" ) ] ( depth, options, inspect ) {
        const spec = this.#key;

        return `${ this.constructor.name }: ${ inspect( spec ) }`;
    }
}
