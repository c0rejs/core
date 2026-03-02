import "#lib/result";
import zlib from "node:zlib";
import Blob from "#lib/blob";
import File from "#lib/file";
import { pathExists } from "#lib/fs";
import Headers from "#lib/http/headers";
import HttpResponse from "#lib/http/response";
import mime from "#lib/mime";
import Range from "#lib/range";
import Ranges from "#lib/ranges";
import stream from "#lib/stream";
import { MultipartStreamEncoder } from "#lib/stream/multipart";
import StreamSlicer from "#lib/stream/slicer";
import { isPlainObject } from "#lib/utils";

const DEFAULT_ENCODING = "gzip",
    ENCODINGS_COMPRESSORS = {
        "br": [ zlib.createBrotliCompress, zlib.brotliCompress ],
        "deflate": [ zlib.createDeflate, zlib.deflate ],
        "gzip": [ zlib.createGzip, zlib.gzip ],
        "identity": null,
        "zstd": [ zlib.createZstdCompress, zlib.zstdCompress ],
    };

export default class Message {
    #status;
    #headers;
    #body;
    #options;

    #isDestroyed = false;
    #isFunction;
    #isStream;
    #isFile;
    #bodyFilename;

    #streams = new Set();
    #middlewares = [];
    #runningMiddleware = false;

    constructor ( message = {} ) {
        if ( !isPlainObject( message ) ) throw new TypeError( "Message should be a plsin object" );

        this.setStatus( message.status );

        this.#headers = new Headers( message.headers );

        // do not replace content type
        this.setBody( message.body );

        if ( message.options ) {
            this.#options = { ...message.options };
        }
        else {
            this.#options = {};
        }
    }

    // static
    static new ( message ) {
        if ( message instanceof Message ) {
            return message;
        }
        else {
            var status, headers, body, options;

            if ( !message ) {
                status = 200;
            }

            // message is status number
            else if ( typeof message === "number" ) {
                status = message;
            }

            // message is plain object
            else if ( isPlainObject( message ) ) {
                ( { status, headers, body, options } = message );
            }

            // message is http response
            else if ( message instanceof HttpResponse ) {
                status = message.status;
                headers = message.headers;
                body = message.body;
            }

            // message is result
            else if ( message instanceof result.Result ) {
                status = message.status;

                if ( isPlainObject( message.data ) ) {
                    ( { headers, body, options } = message.data );
                }
                else {
                    body = message.data;
                }
            }

            // options is body
            else {
                body = message;
            }

            return new this( { status, headers, body, options } );
        }
    }

    // properties
    get ok () {
        return this.#status >= 200 && this.#status < 300;
    }

    get status () {
        return this.#status;
    }

    get statusText () {
        return result.getStatusText( this.#status );
    }

    get headers () {
        return this.#headers;
    }

    get body () {
        return this.#body;
    }

    get options () {
        return this.#options;
    }

    get hasBody () {
        return this.#body != null;
    }

    get isGenerated () {
        return !this.#isFunction && !this.#middlewares.length;
    }

    get isDestroyed () {
        return this.#isDestroyed;
    }

    get isFunction () {
        return this.#isFunction;
    }

    get isStream () {
        return this.#isStream;
    }

    get isFile () {
        return this.#isFile;
    }

    get contentLength () {
        return this.#headers.contentLength.bytes;
    }

    get generatedContentLength () {
        if ( this.isGenerated ) {
            return this.#headers.contentLength.bytes;
        }
        else {
            return;
        }
    }

    get contentType () {
        return this.#headers.contentType.value;
    }

    get contentDisposition () {
        return this.#headers.contentDisposition;
    }

    // public
    setStatus ( status ) {
        if ( this.#isDestroyed ) throw new Error( "Message is destroyed" );

        if ( !status ) {
            this.#status = 200;
        }
        else if ( typeof status === "number" ) {
            this.#status = result.getHttpStatus( status );
        }
        else {
            throw new Error( "HTTP message status is not valid" );
        }

        return this;
    }

    setBody ( body, { encoding } = {} ) {
        if ( this.#isDestroyed ) throw new Error( "Message is destroyed" );

        var contentLength, contentType;

        this.#clearBody();

        if ( body == null ) {
            this.deleteBody();
        }

        // function
        else if ( typeof body === "function" ) {
            if ( this.#runningMiddleware ) throw new Error( "Message body function added from middleware" );

            this.#isFunction = true;
            this.#body = body;
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

                contentType = "application/x-www-form-urlencoded; charset=utf-8";
            }

            // Buffer
            if ( Buffer.isBuffer( body ) ) {
                contentLength = body.length;
            }

            // stream.Readable
            else if ( body instanceof stream.Readable ) {
                contentLength = body.contentLength;
                contentType = body.contentType;
                this.#isStream = true;
                this.#bodyFilename = body.filename;

                this.#streams.add( body );
            }

            // File
            else if ( body instanceof File ) {
                contentLength = body.size;
                contentType = body.type;
                this.#isFile = true;
                this.#bodyFilename = body.name;
            }

            // Blob
            else if ( body instanceof Blob ) {
                contentLength = body.size;
                contentType = body.type;
            }

            // global.Blob
            else if ( body instanceof globalThis.Blob ) {
                body = new Blob( [ body ], {
                    "type": body.type,
                } );

                contentLength = body.size;
                contentType = body.type;
            }
            else {
                throw new TypeError( "Body type is not supported" );
            }

            this.#body = body;

            this.#headers.contentLength.set( contentLength );

            if ( contentType && !this.contentType ) {
                this.#headers.set( "content-type", contentType );
            }
        }

        return this;
    }

    deleteBody () {
        this.#deleteBody();

        return this;
    }

    addLastModifiedFromBody () {
        if ( this.#isFile && !this.#headers.has( "last-modified" ) ) {
            this.#headers.set( "last-modified", this.#body.lastModifiedDate );
        }

        return this;
    }

    addContentDispositionFromBody () {
        if ( !this.contentDisposition.filename && this.#bodyFilename ) {
            this.contentDisposition.setFilename( this.#bodyFilename );
        }

        return this;
    }

    async checkBody () {
        if ( !this.#isFile ) return;

        if ( this.#body.hasSources ) return;

        if ( !( await pathExists( this.#body.path ) ) ) {
            this.setStatus( 404 ).deleteBody();
        }
    }

    checkCache ( method, headers ) {
        if ( !this.ok ) return this;

        IF_MATCH: {
            const etag = this.#headers.etag.etag;
            if ( !etag ) break IF_MATCH;

            const etags = headers.ifMatch.etags;
            if ( !etags ) break IF_MATCH;

            // strong validation, weak etag never match
            if ( etag.startsWith( 'W/"' ) ) {
                return this.setStatus( 412 ).deleteBody();
            }

            // NOTE: for "*" - check if resource exists or return 412
            // NOTE: currently this is not implemented
            if ( etags.has( "*" ) ) break IF_MATCH;

            if ( etags.has( etag ) ) break IF_MATCH;

            return this.setStatus( 412 ).deleteBody();
        }

        IF_NONE_MATCH: {
            const etag = this.#headers.etag.etag;
            if ( !etag ) break IF_NONE_MATCH;

            const etags = headers.ifNoneMatch.etags;
            if ( !etags ) break IF_NONE_MATCH;

            // NOTE: for "*" - check if resource DOES NOT exists or return error
            // NOTE: currently this is not implemented
            if ( etags.has( "*" ) || etags.has( etag ) ) {
                if ( method === "GET" || method === "HEAD" ) {
                    return this.setStatus( 304 ).deleteBody();
                }
                else {
                    return this.setStatus( 412 ).deleteBody();
                }
            }
        }

        IF_MODIFIED_SINCE: {
            if ( method !== "GET" && method !== "HEAD" ) break IF_MODIFIED_SINCE;

            const lastModifiedDate = this.#headers.lastModified.date;
            if ( !lastModifiedDate ) break IF_MODIFIED_SINCE;

            const date = headers.ifModifiedSince.date;
            if ( !date ) break IF_MODIFIED_SINCE;

            if ( lastModifiedDate <= date ) {
                return this.setStatus( 304 ).deleteBody();
            }
        }

        IF_UNMODIFIED_SINCE: {
            const lastModifiedDate = this.#headers.lastModified.date;
            if ( !lastModifiedDate ) break IF_UNMODIFIED_SINCE;

            const date = headers.ifUnmodifiedSince.date;
            if ( !date ) break IF_UNMODIFIED_SINCE;

            if ( lastModifiedDate > date ) {
                return this.setStatus( 412 ).deleteBody();
            }
        }

        return this;
    }

    addMiddleware ( middleware ) {
        if ( this.#isDestroyed ) throw new Error( "Message is destroyed" );

        if ( this.#runningMiddleware ) throw new Error( "Message middleware added from other middleware" );

        if ( middleware ) {
            if ( typeof middleware !== "function" ) throw new Error( "Middleware is not a function" );

            this.#middlewares.push( middleware );
        }

        return this;
    }

    addCompressionMiddleware ( { headers, compress, zlibOptions } = {} ) {
        if ( this.#isDestroyed ) throw new Error( "Message is destroyed" );

        this.headers.add( "vary", "Accept-Encoding" );

        var encoding;

        if ( headers ) {
            const acceptEncodings = headers.acceptEncoding.encodings;
            if ( !acceptEncodings ) return this;

            for ( encoding of acceptEncodings ) {
                if ( encoding in ENCODINGS_COMPRESSORS ) break;
            }

            if ( !encoding ) {
                if ( acceptEncodings.has( "*" ) ) {
                    encoding = DEFAULT_ENCODING;
                }
                else {
                    return this;
                }
            }
        }
        else {
            encoding = DEFAULT_ENCODING;
        }

        const compressor = ENCODINGS_COMPRESSORS[ encoding ];

        if ( !compressor ) return this;

        this.addMiddleware( async message =>
            compressionMiddleware( message, encoding, compressor, {
                compress,
                zlibOptions,
            } ) );

        return this;
    }

    addRangeMiddleware ( { ranges, headers, maxRanges } = {} ) {
        if ( this.#isDestroyed ) throw new Error( "Message is destroyed" );

        this.headers.add( "vary", "Range" );

        if ( ranges ) {
            ranges = Ranges.new( ranges );
        }
        else {
            ranges = headers?.range.ranges;
        }

        // not a ranged request
        if ( !ranges ) return this;

        this.addMiddleware( async message =>
            rangeMiddleware( message, ranges, {
                headers,
                maxRanges,
            } ) );

        return this;
    }

    async generateBody ( { range, createStream } = {} ) {

        // run middlewares if not called from middleware
        MIDDLEWARES: if ( !this.#runningMiddleware && this.#middlewares.length ) {
            while ( true ) {
                const middleware = this.#middlewares.shift();

                if ( !middleware ) break MIDDLEWARES;

                this.#runningMiddleware = true;

                // run middleware
                try {
                    await middleware( this );

                    this.#runningMiddleware = false;
                }
                catch ( e ) {

                    // error calling middleware
                    this.#runningMiddleware = false;

                    await this.#onGenerationError( e );
                }
            }
        }

        // function
        if ( this.#isFunction ) {
            let body;

            try {
                body = await this.#body( { range, createStream } );
            }
            catch ( e ) {
                await this.#onGenerationError( e );
            }

            if ( typeof body === "function" ) {
                throw new TypeError( "Body shoutl not be a function" );
            }

            this.setBody( body );
        }
    }

    async createBody ( { range, createStream } = {} ) {
        if ( !this.isGenerated ) {
            await this.generateBody( { range, createStream } );

            range = null;
        }

        // File
        if ( this.#isFile ) {
            return this.#body.stream( {
                range,
                "type": this.contentType,
            } );
        }

        // Blob
        else if ( this.#body instanceof Blob ) {
            if ( createStream ) {
                return this.#body.stream( {
                    range,
                    "type": this.contentType,
                } );
            }
            else {
                return this.#body.buffer( {
                    range,
                    "type": this.contentType,
                } );
            }
        }

        // stream.Readable
        else if ( this.#isStream ) {
            if ( range ) {
                range = Range.new( range ).createRange( {
                    "contentLength": this.contentLength,
                } );

                if ( range.isFullRange ) {
                    return this.#body;
                }
                else {
                    return StreamSlicer.slice( this.#body, { range } ).setContentType( this.contentType );
                }
            }
            else {
                return this.#body;
            }
        }

        // Buffer
        else {
            let body;

            if ( range ) {
                range = Range.new( range ).createRange( {
                    "contentLength": this.contentLength,
                } );

                if ( range.isFullRange ) {
                    body = this.#body;
                }
                else {
                    body = this.#body.subarray( range.start, range.end );
                }
            }
            else {
                body = this.#body;
            }

            if ( createStream ) {
                body = stream.Readable.from( body ).setContentLength( body.length ).setContentType( this.contentType );
            }

            return body;
        }
    }

    async createBodyStream ( { range } = {} ) {
        return this.createBody( { range, "createStream": true } );
    }

    createBodySync ( { range, createStream } = {} ) {

        // not generated
        if ( !this.isGenerated ) {
            throw new Error( "Message is not generated" );
        }

        // File
        else if ( this.#isFile ) {
            return this.#body.stream( {
                range,
                "type": this.contentType,
            } );
        }

        // Blob
        else if ( this.#body instanceof Blob ) {
            return this.#body.stream( {
                range,
                "type": this.contentType,
            } );
        }

        // stream.Readable
        else if ( this.#isStream ) {
            if ( range ) {
                range = Range.new( range ).createRange( {
                    "contentLength": this.contentLength,
                } );

                if ( range.isFullRange ) {
                    return this.#body;
                }
                else {
                    return StreamSlicer.slice( this.#body, { range } ).setContentType( this.contentType );
                }
            }
            else {
                return this.#body;
            }
        }

        // Buffer
        else {
            let body;

            if ( range ) {
                range = Range.new( range ).createRange( {
                    "contentLength": this.contentLength,
                } );

                if ( range.isFullRange ) {
                    body = this.#body;
                }
                else {
                    body = this.#body.subarray( range.start, range.end );
                }
            }
            else {
                body = this.#body;
            }

            if ( createStream ) {
                body = stream.Readable.from( body ).setContentLength( body.length ).setContentType( this.contentType );
            }

            return body;
        }
    }

    createBodyStreamSync ( { range } = {} ) {
        return this.createBodySync( { range, "createStream": true } );
    }

    async destroy () {
        if ( !this.#isDestroyed ) {
            this.#isDestroyed = true;

            this.#status = 500;

            // remove middlewares
            this.#middlewares.length = 0;

            // delete body
            return this.#deleteBody();
        }
    }

    [ Symbol.dispose ] () {
        this.destroy();
    }

    async [ Symbol.asyncDispose ] () {
        return this.destroy();
    }

    [ Symbol.for( "nodejs.util.inspect.custom" ) ] ( depth, options, inspect ) {
        const spec = {
            "status": `${ this.status } ${ this.statusText }`,
            "isGenerated": this.isGenerated,
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

    // private
    #clearBody () {
        this.#body = null;

        this.#isFunction = false;
        this.#isStream = false;
        this.#isFile = false;
        this.#bodyFilename = undefined;
    }

    async #deleteBody () {
        this.#clearBody();

        // delete "content-*" headers
        for ( const header of this.#headers.keys() ) {
            if ( header.startsWith( "content-" ) ) this.#headers.delete( header );
        }

        // destroy streams
        if ( this.#streams.size ) {
            const streams = this.#streams;
            this.#streams = new Set();

            const promises = [];

            for ( const stream of streams ) {
                if ( stream.closed ) continue;

                promises.push( new Promise( resolve => stream.once( "close", resolve ) ) );

                stream.destroy();
            }

            return Promise.all( promises );
        }
    }

    async #onGenerationError ( e ) {
        this.setStatus( 500 );

        await this.destroy();

        throw e;
    }
}

async function compressionMiddleware ( message, encoding, compressor, { compress, zlibOptions } ) {
    if ( message.isDestroyed ) return;

    if ( !message.hasBody ) return;

    compress = message.options.compress ?? compress;

    // compression is disabled
    if ( !compress ) return;

    // already compressed
    if ( message.headers.has( "content-encoding" ) ) return;

    // do not compress partial content
    if ( message.status === 206 ) return;

    // check minimum content length
    if ( typeof compress !== "boolean" && message.contentLength < compress ) return;

    // check content type is compressible
    const mimeType = mime.get( message.contentType );
    if ( !mimeType?.compressible ) return;

    message.headers.set( "content-encoding", encoding );

    // make etag weak
    const etag = message.headers.get( "etag" );
    if ( etag && !etag.startsWith( "W/" ) ) {
        message.headers.set( "etag", "W/" + etag );
    }

    // generate body
    zlibOptions = message.options.zlibOptions ?? zlibOptions;

    const body = await message.createBody();

    var comressedBody;

    if ( Buffer.isBuffer( body ) ) {
        comressedBody = await new Promise( ( resolve, reject ) =>
            compressor[ 1 ]( body, zlibOptions, ( e, data ) => {
                if ( e ) {
                    reject( e );
                }
                else {
                    resolve( data );
                }
            } ) );
    }
    else if ( body instanceof stream.Readable ) {
        comressedBody = stream.pipeline( body, compressor[ 0 ]( zlibOptions ), e => {} ).setContentType( message.contentType );
    }

    message.setBody( comressedBody );
}

async function rangeMiddleware ( message, ranges, { headers, maxRanges } ) {
    if ( message.isDestroyed ) return;

    if ( !message.hasBody ) return;

    // ranges are not accepted
    if ( !message.headers.acceptRanges.isRangesAccepted ) return;

    // ranges already applied
    if ( message.status === 206 || message.status === 416 ) return;

    // check cache
    if ( headers ) {
        IF_RANGE: {
            if ( !headers.ifRange.hasValue ) break IF_RANGE;

            const ifRange = headers.ifRange;

            if ( ifRange.date ) {
                const lastModifiedDate = message.headers.lastModified.date;
                if ( !lastModifiedDate ) break IF_RANGE;

                if ( lastModifiedDate > ifRange.date ) {
                    return;
                }
            }
            else if ( ifRange.etag ) {
                if ( ifRange.etag === "*" ) break IF_RANGE;

                const etag = message.headers.etag.etag;
                if ( !etag ) break IF_RANGE;

                // strong validation, weak etag never match
                if ( etag.startsWith( 'W/"' ) ) return;

                if ( etag !== ifRange.etag ) return;
            }
        }
    }

    var supported = true,
        multiple = !message.isStream;

    RANGES: {
        if ( !ranges.size || ( maxRanges && ranges.size > maxRanges ) ) {
            supported = false;

            break RANGES;
        }

        if ( !multiple && ranges.size > 1 ) {
            supported = false;

            break RANGES;
        }

        ranges = [ ...ranges ];

        for ( let n = 0; n < ranges.length; n++ ) {
            const range = ranges[ n ].createRange( {
                "contentLength": message.contentLength,
            } );

            if ( range.isFullRange ) {
                return;
            }
            else if ( !range.isValidHttpContentRange ) {
                supported = false;

                break RANGES;
            }

            ranges[ n ] = range;
        }
    }

    // ranges are not supported
    if ( !supported ) {
        message.setStatus( 416 ).deleteBody();

        message.headers.set( {
            "content-range": `bytes */${ message.contentLength ?? "*" }`,
        } );
    }

    // ranges are supported
    else {

        // single range
        if ( ranges.length === 1 ) {
            const range = ranges[ 0 ];

            message.setStatus( 206 );

            message.headers.set( {
                "content-range": range.toContentRangeHeader(),
            } );

            // add body
            const body = await message.createBody( { range } );

            message.setBody( body );
        }

        // multiple ranges
        else {
            message.setStatus( 206 );

            // add body
            const multipartStream = new MultipartStreamEncoder( "byteranges" );

            for ( const range of ranges ) {
                let body;

                // delayed range creation
                if ( message.isFunction || message.isFile ) {
                    const part = new Message( { "body": message.body } );

                    body = async () => part.createBody( { range } );
                }
                else {
                    body = await message.createBody( { range } );
                }

                multipartStream.write( {
                    "headers": {
                        "content-encoding": message.headers.get( "content-encoding" ),
                        "content-type": message.contentType,
                        "content-range": range.toContentRangeHeader(),
                    },
                    body,
                } );
            }

            multipartStream.end();

            message.setBody( multipartStream );

            // set headers
            message.headers.set( {
                "content-type": multipartStream.contentType,
            } );
        }
    }
}
