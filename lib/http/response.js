import "#lib/result";
import Headers from "#lib/http/headers";
import Message from "#lib/message";
import stream from "#lib/stream";
import { MultipartStreamDecoder } from "#lib/stream/multipart";

export default class HttpResponse {
    #response;
    #status;
    #statusText;
    #headers;
    #body;

    constructor ( response ) {
        this.#response = response;
        this.#status = this.#response.status;
        this.#statusText = this.#response.statusText;
    }

    // properties
    get status () {
        return this.#status;
    }

    get statusText () {
        return this.#statusText;
    }

    get ok () {
        return this.#status >= 200 && this.#status < 300;
    }

    get error () {
        return this.#status >= 400 || this.#status < 100;
    }

    get is1xx () {
        return this.#status >= 100 && this.#status < 200;
    }

    get is2xx () {
        return this.#status >= 200 && this.#status < 300;
    }

    get is3xx () {
        return this.#status >= 300 && this.#status < 400;
    }

    get is4xx () {
        return ( this.#status >= 400 && this.#status < 500 ) || this.#status < 100;
    }

    get is5xx () {
        return this.#status >= 500;
    }

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
        return this.body?.arrayBuffer( { maxLength } );
    }

    async blob ( { maxLength, type } = {} ) {
        return this.body?.blob( {
            maxLength,
            type,
        } );
    }

    async buffer ( { maxLength } = {} ) {
        return this.body?.buffer( { maxLength } );
    }

    async bytes ( { maxLength } = {} ) {
        return this.body?.bytes( { maxLength } );
    }

    async json ( { maxLength } = {} ) {
        return this.body?.json( { maxLength } );
    }

    async text ( { maxLength, encoding } = {} ) {
        return this.body?.text( { maxLength, encoding } );
    }

    async toTmpFile ( { maxLength, ...tmpFileOptions } = {} ) {
        return this.body?.toTmpFile( {
            maxLength,
            ...tmpFileOptions,
        } );
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

    toString () {
        return `${ this.#status } ${ this.#statusText }`;
    }

    [ Symbol.for( "nodejs.util.inspect.custom" ) ] ( depth, options, inspect ) {
        const spec = {
            "status": this.#status,
            "statusText": this.#statusText,
            "hasBody": this.hasBody,
            "headers": this.headers,
        };

        return `${ this.constructor.name }: ${ inspect( spec ) }`;
    }
}
