import fs from "node:fs";
import stream from "node:stream";
import Blob from "#lib/blob";
import env from "#lib/env";

export default stream;
export * from "node:stream";

var TmpFile;

const DEFAULT_EOL = Buffer.from( "\n" ),
    HTTP_HEADERS_EOL = Buffer.from( "\r\n\r\n" ),
    DEFAULT_HTTP_HEADERS_MAX_LENGTH = 16_384;

const filenameProperty = Symbol(),
    contentTypeProperty = Symbol(),
    contentLengthProperty = Symbol();

// patch stream.Stream
Object.defineProperties( stream.Stream.prototype, {

    // properties
    "filename": {
        "configurable": false,
        "enumerable": false,
        get () {
            return this[ filenameProperty ];
        },
    },

    "contentType": {
        "configurable": false,
        "enumerable": false,
        get () {
            return this[ contentTypeProperty ];
        },

        // NOTE: patch for express.response
        set ( value ) {
            if ( typeof value === "function" ) return;

            throw new Error( "Attempt to use stream.contentType setter" );
        },
    },

    "contentLength": {
        "configurable": false,
        "enumerable": false,
        get () {
            return this[ contentLengthProperty ];
        },
    },

    // public
    "setFilename": {
        "configurable": false,
        "enumerable": false,
        "writable": false,
        value ( value ) {
            if ( value == null ) {
                this[ filenameProperty ] = undefined;
            }
            else if ( typeof value === "string" ) {
                this[ filenameProperty ] = value || undefined;
            }
            else {
                throw new Error( "Name should be a String" );
            }

            return this;
        },
    },

    "setContentType": {
        "configurable": false,
        "enumerable": false,
        "writable": false,
        value ( value ) {
            if ( value == null ) {
                this[ contentTypeProperty ] = undefined;
            }
            else if ( typeof value === "string" ) {
                this[ contentTypeProperty ] = value || undefined;
            }
            else {
                throw new Error( "Type should be a String" );
            }

            return this;
        },
    },

    "setContentLength": {
        "configurable": false,
        "enumerable": false,
        "writable": false,
        value ( value ) {
            if ( value == null ) {
                this[ contentLengthProperty ] = undefined;
            }
            else if ( typeof value === "number" ) {
                if ( !Number.isInteger( value ) || value < 0 ) throw new Error( "Content length should be a positive integer" );

                this[ contentLengthProperty ] = value;
            }
            else {
                throw new Error( "Content length should be a number" );
            }

            return this;
        },
    },

    [ Symbol.for( "nodejs.util.inspect.custom" ) ]: {
        "configurable": false,
        "enumerable": false,
        "writable": false,
        value ( depth, options, inspect ) {
            const spec = {};

            if ( this.filename ) spec.filename = this.filename;
            if ( this.contentLength != null ) spec.contentLength = this.contentLength;
            if ( this.contentType ) spec.contentType = this.contentType;

            var name;

            if ( this instanceof stream.PassThrough ) {
                name = this.constructor.name + " (stream.PassThrough)";
            }
            else if ( this instanceof stream.Transform ) {
                name = this.constructor.name + " (stream.Transform)";
            }
            else if ( this instanceof stream.Duplex ) {
                name = this.constructor.name + " (stream.Duplex)";
            }
            else if ( this instanceof stream.Readable ) {
                name = this.constructor.name + " (stream.Readable)";
            }
            else if ( this instanceof stream.Writable ) {
                name = this.constructor.name + " (stream.Writable)";
            }
            else {
                name = this.constructor.name + " (stream.Stream)";
            }

            return name + ": " + inspect( spec );
        },
    },
} );

// patch stream.Readable
Object.defineProperties( stream.Readable.prototype, {

    // public
    "arrayBuffer": {
        "configurable": false,
        "enumerable": false,
        "writable": false,
        async value ( { maxLength } = {} ) {
            const buffer = await this.buffer( { maxLength } );

            if ( !buffer ) return;

            return buffer.buffer.slice( buffer.byteOffset, buffer.byteOffset + buffer.byteLength );
        },
    },

    "consume": {
        "configurable": false,
        "enumerable": false,
        "writable": false,
        async value () {

            // strem is destroyed
            if ( this.destroyed ) return;

            return new Promise( resolve => {
                this.once( "close", resolve );

                this.resume();
            } );
        },
    },

    "toBlob": {
        "configurable": false,
        "enumerable": false,
        "writable": false,
        async value ( { maxLength, type } = {} ) {
            const buffer = await this.buffer( { maxLength } );

            if ( !buffer ) return;

            return new Blob( [ buffer ], {
                "type": type === undefined
                    ? this.contentType
                    : type,
            } );
        },
    },

    "buffer": {
        "configurable": false,
        "enumerable": false,
        "writable": false,
        async value ( { maxLength } = {} ) {

            // stream is destroyed
            if ( this.destroyed ) {
                return;
            }
            else {
                let length = 0;
                const buffers = [];

                for await ( let buffer of this ) {
                    if ( !Buffer.isBuffer( buffer ) ) buffer = Buffer.from( buffer );

                    length += buffer.length;

                    // max length
                    if ( maxLength && length > maxLength ) {
                        return;
                    }
                    else {
                        buffers.push( buffer );
                    }
                }

                return Buffer.concat( buffers );
            }
        },
    },

    "bytes": {
        "configurable": false,
        "enumerable": false,
        "writable": false,
        async value ( { maxLength, type } = {} ) {
            const buffer = await this.buffer( { maxLength } );

            if ( !buffer ) return;

            return new Uint8Array( buffer.buffer, buffer.byteOffset, buffer.byteLength );
        },
    },

    "json": {
        "configurable": false,
        "enumerable": false,
        "writable": false,
        async value ( { maxLength } = {} ) {
            const buffer = await this.buffer( { maxLength } );

            if ( !buffer ) return;

            if ( !buffer.length ) return;

            try {
                return JSON.parse( buffer );
            }
            catch ( e ) {
                if ( env.isDevelopment ) {
                    console.log( "Invalid JSON:\n", buffer );
                }

                throw e;
            }
        },
    },

    "text": {
        "configurable": false,
        "enumerable": false,
        "writable": false,
        async value ( { maxLength, encoding } = {} ) {
            const buffer = await this.buffer( { maxLength } );

            if ( !buffer ) return;

            return buffer.toString( encoding );
        },
    },

    "tmpFile": {
        "configurable": false,
        "enumerable": false,
        "writable": false,
        async value ( { maxLength, ...tmpFileOptions } = {} ) {

            // import TmpFile
            if ( !TmpFile ) {
                ( { TmpFile } = await import( "#lib/tmp" ) );
            }

            // stream is destroyed
            if ( this.destroyed ) {
                return;
            }

            const tmpFile = TmpFile.new( tmpFileOptions ),
                tmpFileStream = fs.createWriteStream( tmpFile.path );

            let maxLengthError;

            if ( maxLength ) {
                let length = 0;

                this.on( "data", data => {
                    if ( !Buffer.isBuffer( data ) ) data = Buffer.from( data );

                    length += data.length;

                    if ( length > maxLength ) {
                        maxLengthError = true;

                        tmpFileStream.destroy( "Length limit" );
                    }
                } );
            }

            try {
                await stream.promises.pipeline( this, tmpFileStream );

                return tmpFile;
            }
            catch ( e ) {
                this.destroy();

                tmpFile.destroy();

                if ( maxLengthError ) {
                    return;
                }
                else {
                    throw e;
                }
            }
        },
    },

    "readHttpHeaders": {
        "configurable": false,
        "enumerable": false,
        "writable": false,
        async value ( { maxLength } = {} ) {
            return this.readLine( {
                "eol": HTTP_HEADERS_EOL,
                "maxLength": maxLength || DEFAULT_HTTP_HEADERS_MAX_LENGTH,
                "encoding": "latin1",
            } );
        },
    },

    "readChunk": {
        "configurable": false,
        "enumerable": false,
        "writable": false,
        async value ( chunkLength, { encoding } = {} ) {

            // stream is destroyed, no more data can be read
            if ( this.destroyed ) return;

            if ( !( chunkLength > 0 ) ) return;

            // chunk is already buffered
            if ( this.readableLength >= chunkLength ) {
                return encoding
                    ? this.read( chunkLength ).toString( encoding )
                    : this.read( chunkLength );
            }

            return new Promise( ( resolve, reject ) => {
                var error,
                    readable,
                    buffers = [],
                    totalLength = 0;

                const done = ( e, buffer ) => {
                    this.off( "error", error );
                    this.off( "readable", readable );

                    if ( e ) {
                        reject( e );
                    }
                    else if ( buffer ) {
                        resolve( encoding
                            ? buffer.toString( encoding )
                            : buffer );
                    }
                    else {
                        this.destroy();

                        resolve();
                    }
                };

                error = e => done( e );

                readable = () => {
                    var size = chunkLength - totalLength;

                    if ( this.readableLength && this.readableLength < size ) {
                        size = this.readableLength;
                    }

                    var chunk = this.read( size );

                    if ( chunk ) {
                        if ( !Buffer.isBuffer( chunk ) ) chunk = Buffer.from( chunk );

                        buffers.push( chunk );
                        totalLength += chunk.length;

                        if ( totalLength >= chunkLength ) {
                            const buffer = Buffer.concat( buffers );

                            if ( totalLength === chunkLength ) {
                                done( null, buffer );
                            }
                            else {
                                this.unshift( buffer.subarray( chunkLength ) );

                                done( null, buffer.subarray( 0, chunkLength ) );
                            }
                        }
                    }

                    // eof
                    else {
                        done();
                    }
                };

                // set events listeners
                this.once( "error", error );
                this.on( "readable", readable );
            } );
        },
    },

    "readLine": {
        "configurable": false,
        "enumerable": false,
        "writable": false,
        async value ( { eol, maxLength, encoding, lastEolRequired = true } = {} ) {

            // stream is destroyed
            if ( this.destroyed ) return;

            eol = eol == null
                ? DEFAULT_EOL
                : Buffer.isBuffer( eol )
                    ? eol
                    : Buffer.from( eol, encoding );

            return new Promise( ( resolve, reject ) => {
                var error, readable, buffer;

                const done = ( e, buffer ) => {
                    this.off( "error", error );
                    this.off( "readable", readable );

                    if ( e ) {
                        this.reject( e );
                    }
                    else if ( buffer ) {
                        resolve( encoding
                            ? buffer.toString( encoding )
                            : buffer );
                    }
                    else {
                        this.destroy();

                        resolve();
                    }
                };

                error = e => done( e );

                readable = () => {
                    var size;

                    if ( maxLength ) {
                        size = maxLength + eol.length;

                        if ( buffer ) {
                            size -= buffer.length;
                        }

                        if ( this.readableLength && this.readableLength < size ) {
                            size = this.readableLength;
                        }
                    }

                    var chunk = this.read( size );

                    if ( chunk ) {
                        if ( !Buffer.isBuffer( chunk ) ) chunk = Buffer.from( chunk );

                        let start;

                        if ( buffer ) {
                            start = Math.max( 0, buffer.length - eol.length );

                            buffer = Buffer.concat( [ buffer, chunk ] );
                        }
                        else {
                            start = 0;

                            buffer = chunk;
                        }

                        const idx = buffer.indexOf( eol, start );

                        // found
                        if ( idx > -1 ) {
                            const line = buffer.subarray( 0, idx );

                            // max. length
                            if ( maxLength && line.length > maxLength ) {
                                done();
                            }
                            else {
                                buffer = buffer.subarray( idx + eol.length );

                                if ( buffer.length ) {
                                    this.unshift( buffer );
                                }

                                done( null, line );
                            }
                        }

                        // not found
                        else {

                            // max. length
                            if ( maxLength && buffer.length >= maxLength + eol.length ) {
                                done();
                            }
                        }
                    }

                    // eof
                    else {
                        if ( !lastEolRequired && buffer ) {
                            this.destroy();

                            done( null, buffer );
                        }
                        else {
                            done();
                        }
                    }
                };

                // set events listeners
                this.once( "error", error );
                this.on( "readable", readable );
            } );
        },
    },
} );
