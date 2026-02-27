import Blob from "#lib/blob";
import File from "#lib/file";
import Range from "#lib/range";
import stream from "#lib/stream";
import StreamSlicer from "#lib/stream/slicer";

export default class Body {
    #body;
    #contentLength;
    #contentType;
    #filename;
    #lastModifiedDate;
    #isFunction = false;
    #isFile = false;
    #isStream = false;
    #isFileExists;
    #isDestroyed = false;

    constructor ( body, { encoding } = {} ) {
        if ( body == null ) {
            this.#contentLength = 0;
        }

        // Body
        else if ( body instanceof this.constructor ) {
            this.#body = body.body;
            this.#contentLength = body.contentLength;
            this.#contentType = body.contentType;
            this.#filename = body.filename;
            this.#lastModifiedDate = body.lastModifiedDate;
        }
        else {

            // string
            if ( typeof body === "string" ) {
                body = Buffer.from( body, encoding );
            }

            // number
            else if ( typeof body === "number" ) {
                body = Buffer.from( body.toString() );
            }

            // URLSearchParams
            else if ( body instanceof URLSearchParams ) {
                body = Buffer.from( body.toString() );

                this.#contentType = "application/x-www-form-urlencoded; charset=utf-8";
            }

            // Buffer
            if ( Buffer.isBuffer( body ) ) {
                this.#contentLength = body.length;
            }

            // stream.Readable
            else if ( body instanceof stream.Readable ) {
                this.#contentLength = body.contentLength;
                this.#filename = body.filename;
                this.#isStream = true;
                this.#isDestroyed = body.destroyed;
                this.#contentType = body.contentType;
            }

            // File
            else if ( body instanceof File ) {
                this.#contentLength = body.size;
                this.#contentType = body.type;
                this.#filename = body.name;
                this.#lastModifiedDate = body.lastModifiedDate;
                this.#isFile = true;
                this.#isFileExists = this.#contentLength != null;
            }

            // Blob
            else if ( body instanceof Blob ) {
                this.#contentLength = body.size;
                this.#contentType = body.type;
            }

            // global.Blob
            else if ( body instanceof globalThis.Blob ) {
                body = new Blob( [ body ], {
                    "type": body.type,
                } );

                this.#contentLength = body.size;
                this.#contentType = body.type;
            }

            // function
            else if ( typeof body === "function" ) {
                this.#isFunction = true;
            }
            else {
                throw new Error( "Body type is not supported" );
            }

            this.#body = body;
        }
    }

    // static
    static new ( body, options ) {
        if ( body instanceof this ) {
            return body;
        }
        else {
            return new this( body, options );
        }
    }

    // properties
    get body () {
        return this.#body;
    }

    get contentLength () {
        return this.#contentLength;
    }

    get contentType () {
        return this.#contentType;
    }

    get filename () {
        return this.#filename;
    }

    get lastModifiedDate () {
        return this.#lastModifiedDate;
    }

    get hasBody () {
        return this.#body != null;
    }

    get isFunction () {
        return this.#isFunction;
    }

    get isFile () {
        return this.#isFile;
    }

    get isStream () {
        return this.#isStream;
    }

    get isFileExists () {
        return this.#isFileExists;
    }

    get isDestroyed () {
        return this.#isDestroyed;
    }

    // public
    createBody ( { range } = {} ) {

        // function
        if ( this.#isFunction ) {
            throw new Error( "HTTP body is function" );
        }

        // File
        else if ( this.#isFile ) {
            return this.#body.stream( {
                range,
                "type": this.#contentType,
            } );
        }

        // Blob
        else if ( this.#body instanceof Blob ) {
            return this.#body.stream( {
                range,
                "type": this.#contentType,
            } );
        }

        // stream.Readable
        else if ( this.#isStream ) {
            range = Range.new( range ).createRange( {
                "contentLength": this.contentLength,
            } );

            if ( range.isFullRange ) {
                return this.#body;
            }
            else {
                return StreamSlicer.slice( this.#body, { range } ).setContentType( this.#contentType );
            }
        }

        // Buffer
        else {
            range = Range.new( range ).createRange( {
                "contentLength": this.contentLength,
            } );

            if ( range.isFullRange ) {
                return this.#body;
            }
            else {
                return this.#body.subarray( range.start, range.end );
            }
        }
    }

    stream ( { range } = {} ) {
        var body = this.createBody( { range } );

        if ( Buffer.isBuffer( body ) ) {
            body = stream.Readable.from( body ).setContentLength( body.length ).setContentType( this.#contentType );
        }

        return body;
    }

    destroy () {
        if ( !this.#isDestroyed ) {
            this.#isDestroyed = true;

            if ( this.#isStream ) {
                this.#body.destroy();
            }
        }

        return this;
    }

    [ Symbol.for( "nodejs.util.inspect.custom" ) ] ( depth, options, inspect ) {
        const spec = {
            "hasBody": this.hasBody,
        };

        if ( this.hasBody ) {
            spec.contentLength = this.contentLength;

            if ( this.contentType ) {
                spec.contentType = this.contentType;
            }
        }

        return `${ this.constructor.name }: ${ inspect( spec ) }`;
    }
}
