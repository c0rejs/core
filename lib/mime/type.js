import MimeTypeExtnames from "#lib/mime/type/extnames";
import MimeTypeFilenames from "#lib/mime/type/filenames";
import MimeTypeShebangs from "#lib/mime/type/shebangs";
import { compare } from "#lib/utils";

export default class MimeType {
    #mime;
    #essence;
    #type;
    #subtype;
    #compressible;
    #charset;
    #extnames;
    #filenames;
    #shebangs;

    constructor ( { mime, essence, compressible, charset, extnames, filenames, shebangs } = {} ) {
        this.#mime = mime;
        this.#essence = essence;
        this.setCompressible( compressible );
        this.setCharset( charset );

        this.#extnames = new MimeTypeExtnames( this, extnames );
        this.#filenames = new MimeTypeFilenames( this, filenames );
        this.#shebangs = new MimeTypeShebangs( this, shebangs );
    }

    // static
    static new ( mimeType ) {
        if ( mimeType instanceof this ) {
            return mimeType;
        }
        else {
            return new this( mimeType );
        }
    }

    static get compare () {
        return ( a, b ) => this.new( a ).compare( b );
    }

    // properties
    get mime () {
        return this.#mime;
    }

    get essence () {
        return this.#essence;
    }

    get type () {
        if ( this.#type === undefined ) {
            [ this.#type, this.#subtype ] = this.#essence.split( "/", 2 );
        }

        return this.#type;
    }

    get subtype () {
        if ( this.#subtype === undefined ) {
            [ this.#type, this.#subtype ] = this.#essence.split( "/", 2 );
        }

        return this.#subtype;
    }

    get compressible () {
        return this.#compressible;
    }

    get charset () {
        return this.#charset;
    }

    get extnames () {
        return this.#extnames;
    }

    get filenames () {
        return this.#filenames;
    }

    get shebangs () {
        return this.#shebangs;
    }

    // public
    toString () {
        return this.#essence;
    }

    toJSON () {
        const json = {
            "essence": this.#essence,
        };

        if ( this.#compressible ) {
            json.compressible = true;
        }

        if ( this.#charset ) {
            json.charset = this.#charset;
        }

        const extnames = this.#extnames.toJSON();
        if ( extnames ) json.extnames = extnames;

        const filenames = this.#filenames.toJSON();
        if ( filenames ) json.filenames = filenames;

        const shebangs = this.#shebangs.toJSON();
        if ( shebangs ) json.shebangs = shebangs;

        return json;
    }

    setCompressible ( value ) {
        this.#compressible = Boolean( value );

        return this;
    }

    setCharset ( charset ) {
        this.#charset = charset || null;

        return this;
    }

    delete () {
        this.#mime?.delete( this.#essence );

        this.#mime = null;

        return this;
    }

    compare ( mimeType ) {
        mimeType = this.constructor.new( mimeType );

        return compare( this.type, mimeType.type ) || compare( this.subtype, mimeType.subtype );
    }

    [ Symbol.for( "nodejs.util.inspect.custom" ) ] ( depth, options, inspect ) {
        const spec = {
            "essence": this.essence,
        };

        if ( this.#compressible ) spec.compressible = this.#compressible;
        if ( this.#charset ) spec.charset = this.#charset;

        if ( this.extnames.size ) spec.extnames = [ ...this.extnames ].sort();
        if ( this.filenames.size ) spec.filenames = [ ...this.filenames ].sort();
        if ( this.shebangs.size ) spec.shebangs = [ ...this.shebangs ].sort();

        return `${ this.constructor.name }: ${ inspect( spec ) }`;
    }
}
