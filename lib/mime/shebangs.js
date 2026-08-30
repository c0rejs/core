export default class MimeShebangs {
    #mime;
    #shebangs = new Map();

    constructor ( mime ) {
        this.#mime = mime;
    }

    // properties
    get size () {
        return this.#shebangs.size;
    }

    // public
    has ( shebang ) {
        if ( shebang instanceof RegExp ) {
            shebang = shebang.toString();
        }

        return this.#shebangs.has( shebang );
    }

    add ( essence, shebangs ) {
        const mimeType = this.#mime.get( essence );

        if ( !mimeType ) throw new Error( "MIME type not registered" );

        if ( !Array.isArray( shebangs ) ) shebangs = [ shebangs ];

        for ( let shebang of shebangs ) {
            if ( !mimeType.shebangs.has( shebang ) ) {
                mimeType.shebangs.add( shebang );
            }
            else {
                if ( shebang instanceof RegExp ) {
                    shebang = shebang.toString();
                }

                const currentMimeType = this.#shebangs.get( shebang )?.mimeType;

                if ( currentMimeType && currentMimeType.essence !== mimeType.essence ) {
                    currentMimeType.shebangs.delete( shebang );
                }

                this.#shebangs.set( shebang, {
                    "regexp": mimeType.shebangs.get( shebang ),
                    mimeType,
                } );
            }
        }

        return this;
    }

    delete ( shebangs ) {
        if ( !Array.isArray( shebangs ) ) shebangs = [ shebangs ];

        for ( let shebang of shebangs ) {
            if ( shebang instanceof RegExp ) {
                shebang = shebang.toString();
            }

            const currentMimeType = this.#shebangs.get( shebang )?.mimeType;

            if ( currentMimeType ) {
                this.#shebangs.delete( shebang );

                currentMimeType.shebangs.delete( shebang );
            }
        }

        return this;
    }

    clear () {
        for ( const item of this.#shebangs ) {
            this.delete( item );
        }

        return this;
    }

    findMimeType ( content ) {
        if ( content.startsWith( "#!" ) ) {
            for ( const { regexp, mimeType } of this.#shebangs.values() ) {
                if ( regexp.test( content ) ) return mimeType;
            }
        }
    }

    toJSON () {
        const json = {};

        for ( const [ shebang, { mimeType } ] of this.#shebangs.entries() ) {
            json[ shebang ] = mimeType.essence;
        }

        return json;
    }

    * [ Symbol.iterator ] () {
        for ( const { regexp, mimeType } of this.#shebangs.values() ) {
            yield [ regexp, mimeType ];
        }
    }
}
