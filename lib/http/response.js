import "#lib/result";
import Headers from "#lib/http/headers";
import Message from "#lib/message";
import stream from "#lib/stream";
import { MultipartStreamDecoder } from "#lib/stream/multipart";

export default class Response extends result.Result {
    #response;
    #headers;
    #body;

    constructor ( response ) {
        super( [ response.status, response.statusText ] );

        this.#response = response;
    }

    // properties
    get url () {
        return this.#response.url;
    }

    get headers () {
        this.#headers ??= new Headers( this.#response.headers );

        return this.#headers;
    }

    get hasBody () {
        return Boolean( this.#response.body );
    }

    get bodyUsed () {
        return this.#response.bodyUsed;
    }

    get body () {
        if ( this.hasBody ) {
            if ( !this.#body ) {
                this.#body = stream.Readable.fromWeb( this.#response.body );

                this.#body.setContentLength( this.headers.contentLength.bytes );
                this.#body.setContentType( this.headers.get( "content-type" ) );
                this.#body.setFilename( this.headers.contentDisposition.filename );
            }
        }

        return this.#body;
    }

    get redirected () {
        return this.#response.redirected;
    }

    get type () {
        return this.#response.type;
    }

    get cookies () {
        return this.#response.cookies;
    }

    // public
    async arrayBuffer ( { maxLength } = {} ) {
        return this.body.arrayBuffer( { maxLength } );
    }

    async blob ( { maxLength, type } = {} ) {
        return this.body.blob( {
            maxLength,
            "type": type || this.headers.get( "content-type" ),
        } );
    }

    async buffer ( { maxLength } = {} ) {
        return this.body.buffer( { maxLength } );
    }

    async json ( { maxLength } = {} ) {
        return this.body.json( { maxLength } );
    }

    async tmpFile ( options = {} ) {
        options = { ...options };

        if ( options.type === undefined && this.headers.has( "content-type" ) ) {
            options.type = this.headers.get( "content-type" );
        }

        if ( options.lastModified === undefined && this.headers.lastModified.date ) {
            options.lastModified = this.headers.lastModified.date;
        }

        return this.body.tmpFile( options );
    }

    async text ( { maxLength, encoding } = {} ) {
        return this.body.text( { maxLength, encoding } );
    }

    toMessage () {
        return new Message( {
            "status": this.status,
            "headers": this.headers,
            "body": this.body,
        } );
    }

    async parseMultipartBody ( { maxContentLength, maxBufferLength } = {} ) {
        return MultipartStreamDecoder.parseMultipartStream( this.body, {
            "boundary": this.headers.contentType.boundary,
            maxContentLength,
            maxBufferLength,
        } );
    }
}
