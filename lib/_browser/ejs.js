import _ejs from "ejs";

export class Ejs {
    #tenderer;

    constructor ( template, options ) {
        this.#tenderer = _ejs.compile( template, options );
    }

    // static
    static get Template () {
        return _ejs.Template;
    }

    static new ( template, options ) {
        if ( template instanceof this ) {
            return template;
        }
        else {
            return new this( template, options );
        }
    }

    // public
    render ( data ) {
        return this.#tenderer( data );
    }
}

export default function ejs ( template, options ) {
    return Ejs.new( template, options );
}
