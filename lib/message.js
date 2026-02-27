import "#lib/result";
import zlib from "node:zlib";
import Headers from "#lib/http/headers";
import HttpResponse from "#lib/http/response";
import Body from "#lib/message/body";
import mime from "#lib/mime";
import Ranges from "#lib/ranges";
import stream from "#lib/stream";
import { MultipartStreamEncoder } from "#lib/stream/multipart";
import { isPlainObject } from "#lib/utils";

const DEFAULT_ENCODING = "gzip",
    ENCODINGS_COMPRESSORS = {
        "br": zlib.createBrotliCompress,
        "deflate": zlib.createDeflate,
        "gzip": zlib.createGzip,
        "identity": null,
        "zstd": zlib.createZstdCompress,
    };

const CALL_BODY_FUNCTION_PROPERTY = Symbol();

export default class Message {
    #status;
    #headers;
    #body;
    #options;
    #wrappedBodies = [];

    constructor ( { status, headers, body, options } = {} ) {
        this.#setStatus( status );

        this.#headers = new Headers( headers );

        this.#setBody( body );

        if ( options ) {
            this.#options = { ...options };
        }
        else {
            this.#options = {};
        }
    }

    // static
    static new ( message ) {
        if ( message instanceof this ) {
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

    get hasBody () {
        return this.#body != null && this.#body.hasBody;
    }

    get body () {
        return this.#body;
    }

    get options () {
        return this.#options;
    }

    get contentLength () {
        return this.#headers.contentLength.bytes;
    }

    get contentType () {
        return this.#headers.contentType.value;
    }

    get contentDisposition () {
        return this.#headers.contentDisposition;
    }

    get isDestroyed () {
        return this.#body?.isDestroyed;
    }

    // public
    addContentDispositionFromBody () {
        if ( !this.contentDisposition.filename && this.#body.filename ) {
            this.contentDisposition.setFilename( this.#body.filename );
        }

        return this;
    }

    checkBody () {
        if ( this.ok && this.#body?.isFile ) {
            if ( !this.#body.isFileExists ) {
                this.#dropBody( 404 );
            }
        }

        return this;
    }

    checkCache ( method, headers ) {
        if ( !this.ok ) return;

        IF_MATCH: {
            const etag = this.#headers.etag.etag;
            if ( !etag ) break IF_MATCH;

            const etags = headers.ifMatch.etags;
            if ( !etags ) break IF_MATCH;

            // strong validation, weak etag never match
            if ( etag.startsWith( 'W/"' ) ) {
                return this.#dropBody( 412 );
            }

            // NOTE: for "*" - check if resource exists or return 412
            // NOTE: currently this is not implemented
            if ( etags.has( "*" ) ) break IF_MATCH;

            if ( etags.has( etag ) ) break IF_MATCH;

            return this.#dropBody( 412 );
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
                    return this.#dropBody( 304 );
                }
                else {
                    return this.#dropBody( 412 );
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
                return this.#dropBody( 304 );
            }
        }

        IF_UNMODIFIED_SINCE: {
            const lastModifiedDate = this.#headers.lastModified.date;
            if ( !lastModifiedDate ) break IF_UNMODIFIED_SINCE;

            const date = headers.ifUnmodifiedSince.date;
            if ( !date ) break IF_UNMODIFIED_SINCE;

            if ( lastModifiedDate > date ) {
                return this.#dropBody( 412 );
            }
        }
    }

    // XXX - delete this body
    async callBodyFunction () {
        if ( !this.#body?.isFunction ) return;

        const body = this.#body;

        this.#body = undefined;

        await this[ CALL_BODY_FUNCTION_PROPERTY ]( body.body );

        // XXX ???
        this.checkBody();
    }

    checkCompression ( headers, { createBody, compress, zlibOptions } = {} ) {
        if ( !this.hasBody ) return;

        compress = this.#options.compress ?? compress;

        // compression is disabled
        if ( !compress ) return;

        // already compressed
        if ( this.#headers.get( "content-encoding" ) ) return;

        this.#headers.add( "vary", "Accept-Encoding" );

        // do not compress partial content
        if ( this.#status === 206 ) return;

        // check minimum content length
        if ( typeof compress !== "boolean" && this.contentLength < compress ) return;

        // check content type is compressible
        const mimeType = mime.get( this.contentType );
        if ( !mimeType?.compressible ) return;

        const acceptEncodings = headers.acceptEncoding.encodings;
        if ( !acceptEncodings ) return;

        var encoding;

        for ( encoding of acceptEncodings ) {
            if ( encoding in ENCODINGS_COMPRESSORS ) break;
        }

        if ( !encoding ) {
            if ( acceptEncodings.has( "*" ) ) {
                encoding = DEFAULT_ENCODING;
            }
            else {
                return;
            }
        }

        const compressor = ENCODINGS_COMPRESSORS[ encoding ];

        if ( !compressor ) return;

        this.#headers.set( "content-encoding", encoding );

        // make etag weak
        const etag = this.#headers.get( "etag" );
        if ( etag && !etag.startsWith( "W/" ) ) {
            this.#headers.set( "etag", "W/" + etag );
        }

        // prepare compressed body stream
        if ( createBody ) {
            zlibOptions = this.#options.zlibOptions ?? zlibOptions;

            // pipe body to zlib compressor
            const body = stream.pipeline( this.#body.stream(), compressor( zlibOptions ), e => {} ).setContentType( this.contentType );

            this.#setBody( body );
        }
        else {
            this.#headers.delete( "content-length" );
        }
    }

    async checkHttpRange ( headers, { createBody, maxRanges } = {} ) {
        if ( !this.hasBody ) return;

        // ranges are not supported
        if ( !this.#headers.acceptRanges.isRangesAccepted ) return;

        // ranges already applied
        if ( this.#status === 206 || this.#status === 416 ) return;

        const ranges = headers.range.ranges;

        // not a ranged request
        if ( !ranges ) return;

        IF_RANGE: {
            if ( !headers.ifRange.hasValue ) break IF_RANGE;

            const ifRange = headers.ifRange;

            if ( ifRange.date ) {
                const lastModifiedDate = this.#headers.lastModified.date;
                if ( !lastModifiedDate ) break IF_RANGE;

                if ( lastModifiedDate > ifRange.date ) {
                    return;
                }
            }
            else if ( ifRange.etag ) {
                if ( ifRange.etag === "*" ) break IF_RANGE;

                const etag = this.#headers.etag.etag;
                if ( !etag ) break IF_RANGE;

                // strong validation, weak etag never match
                if ( etag.startsWith( 'W/"' ) ) return;

                if ( etag !== ifRange.etag ) return;
            }
        }

        await this.applyRanges( ranges, {
            maxRanges,
            createBody,
        } );
    }

    async applyRanges ( ranges, { maxRanges, createBody = true } = {} ) {
        ranges = Ranges.new( ranges );

        var supported = true,
            multiple = !this.#body.isStream;

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
                    "contentLength": this.contentLength,
                } );

                if ( !range.isValidHttpContentRange ) {
                    supported = false;

                    break RANGES;
                }

                ranges[ n ] = range;
            }
        }

        // ranges are not supported
        if ( !supported ) {
            this.#dropBody( 416 );

            this.#headers.set( {
                "accept-ranges": "bytes",
                "content-range": `bytes */${ this.contentLength ?? "*" }`,
                "vary": "Range",
            } );
        }

        // ranges are supported
        else {

            // single range
            if ( ranges.length === 1 ) {
                const range = ranges[ 0 ];

                if ( createBody ) {
                    let body;

                    if ( this.#body.isFunction ) {
                        var message = await this.#body.body();

                        message = this.constructor.new( message );

                        body = message.createBody( { range } );
                    }
                    else {
                        body = this.createBody( { range } );
                    }

                    this.#setBody( body );
                }

                this.#setStatus( 206 );

                this.#headers.set( {
                    "accept-ranges": "bytes",
                    "content-length": range.length,
                    "content-range": range.toContentRangeHeader(),
                    "vary": "Range",
                } );
            }

            // multiple ranges
            else {
                if ( createBody ) {
                    const multipartStream = new MultipartStreamEncoder( "byteranges" ),
                        body = this.#body;

                    for ( const range of ranges ) {
                        multipartStream.write( {
                            "headers": {
                                "content-type": this.contentType,
                                "content-range": range.toContentRangeHeader(),
                                "content-encoding": this.#headers.get( "content-encoding" ),
                            },
                            "body": async () => {
                                if ( body.isFunction ) {
                                    var message = await body.body();

                                    message = Message.new( message );

                                    return message.createBody( { range } );
                                }
                                else {
                                    return body.createBody( { range } );
                                }
                            },
                        } );
                    }

                    multipartStream.end();

                    this.#setStatus( 206 );

                    this.#headers.set( {
                        "accept-ranges": "bytes",
                        "vary": "Range",
                    } );

                    this.#setBody( multipartStream );
                }
                else {
                    this.#setStatus( 206 );

                    this.#headers.set( {
                        "accept-ranges": "bytes",
                        "content-length": null,
                        "content-type": `multipart/byteranges; boundary=${ MultipartStreamEncoder.generateBoundary() }`,
                        "vary": "Range",
                    } );
                }
            }
        }

        return this;
    }

    // XXX track destroy
    // XXX track destroy in stream.Joiner
    wrap ( func ) {
        const originalBody = this.#body;

        if ( originalBody ) {
            this.#wrappedBodies.push( originalBody );
        }

        const body = async message => {
            if ( originalBody?.isFunction ) {
                this[ CALL_BODY_FUNCTION_PROPERTY ].call( message, originalBody.body );
            }
            else {
                this.#body = originalBody;
            }

            console.log( "--- WTAP", originalBody.body, this.#body?.body );

            return func( message );
        };

        this.#setBody( body );

        return this;
    }

    createBody ( { range } = {} ) {
        return this.#body?.createBody( { range } );
    }

    stream ( { range } = {} ) {
        return this.#body?.stream( { range } );
    }

    destroy () {
        this.#body?.destroy();

        const bodies = this.#wrappedBodies;
        this.#wrappedBodies;

        for ( const body of bodies ) {
            body.destroy();
        }

        return this;
    }

    [ Symbol.for( "nodejs.util.inspect.custom" ) ] ( depth, options, inspect ) {
        const spec = {
            "status": `${ this.status } ${ this.statusText }`,
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
    #setStatus ( status ) {
        if ( !status ) {
            this.#status = 200;
        }
        else if ( typeof status === "number" ) {
            this.#status = result.getHttpStatus( status );
        }
        else {
            throw new Error( "HTTP message status is not valid" );
        }
    }

    // XXX remove destroy
    #setBody ( body, { destroy } = {} ) {
        body = Body.new( body );

        if ( body.hasBody ) {
            if ( destroy ) {
                this.#deleteBody();
            }

            this.#body = body;

            this.#headers.set( "content-length", this.#body.contentLength );

            if ( !this.contentType ) {
                this.#headers.set( "content-type", this.#body.contentType );
            }

            if ( !this.#headers.has( "last-modified" ) && this.#body.lastModifiedDate ) {
                this.#headers.lastModified.set( this.#body.lastModifiedDate );
            }
        }
        else {
            this.#deleteBody();
        }
    }

    #dropBody ( status ) {
        this.#setStatus( status );

        this.#deleteBody();
    }

    // XXX headers
    // XXX lastModified
    #deleteBody () {
        this.#body?.destroy();

        this.#body = null;

        this.#headers.delete( "content-length" );
        this.#headers.delete( "content-type" );
        this.#headers.delete( "last-modified" );
    }

    // XXX returned body should not be a func
    async [ CALL_BODY_FUNCTION_PROPERTY ] ( func ) {
        var message = await func( this );

        if ( message == null ) return;

        message = Message.new( message );

        this.#setStatus( message.status );

        this.#headers.set( message.headers );

        this.#setBody( message.body, {
            "destroy": true,
        } );
    }
}
