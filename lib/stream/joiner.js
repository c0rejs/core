import Message from "#lib/message";
import mixins from "#lib/mixins";
import stream from "#lib/stream";

const DelayedTransformMixin = Super =>
    class extends Super {
        #pendingChunks = [];
        #isReading = false;

        // public
        read ( size ) {
            if ( !this.#isReading ) {
                this.#isReading = true;

                for ( const chunk of this.#pendingChunks ) {
                    this._transform( ...chunk );
                }

                this.#pendingChunks = null;
            }

            return super.read( size );
        }

        // protected
        async _transform ( chunk, encoding, callback ) {
            if ( !this.#isReading ) {
                this.#pendingChunks.push( [ chunk, encoding, callback ] );
            }
            else {
                super._transform( chunk, encoding, callback );
            }
        }
    };

const StreamJoinerMixin = Super =>
    class extends stream.Transform {
        #autoEnd;
        #messages = new Set();
        #stream;
        #callback;
        #readableListener = this.#onReadable.bind( this );
        #errorListener = this.#onError.bind( this );
        #closeListener = this.#onClose.bind( this );
        #contentLengthDefined = true;

        constructor ( { autoEnd } = {} ) {
            super( {
                "writableObjectMode": true,
                "writableHighWaterMark": 1,
            } );

            this.#autoEnd = Boolean( autoEnd );
        }

        // properties
        get autoEnd () {
            return this.#autoEnd;
        }

        // public
        write ( chunk, encoding, callback ) {
            if ( typeof encoding === "function" ) {
                callback = encoding;
                encoding = undefined;
            }

            const message = Message.new( chunk );

            this.#messages.add( message );

            const chunkContentLength = message.contentLength;

            // track stream content length
            if ( this.#contentLengthDefined ) {
                if ( chunkContentLength == null ) {
                    this._setContentLength( null );
                    this.#contentLengthDefined = false;
                }
                else {
                    this._setContentLength( ( this.contentLength ?? 0 ) + chunkContentLength );
                }
            }

            super.write( message, encoding, callback );
        }

        read ( size ) {

            // auto end stream on first read
            if ( this.#autoEnd && !this.writableEnded ) {
                this.end();
            }

            return super.read( size );
        }

        setContentLength ( contentLength ) {
            return this;
        }

        // protected
        async _transform ( chunk, encoding, callback ) {
            const message = chunk;

            // function
            if ( message.body?.isFunction ) {
                try {
                    await message.callBodyFunction();
                }
                catch ( e ) {
                    return callback( e );
                }
            }

            // ignore chunk
            if ( !message.hasBody ) {
                return callback();
            }

            chunk = message.createBody();

            if ( chunk instanceof stream.Readable ) {
                if ( chunk.errored ) {
                    return callback( chunk.errored );
                }
                else {
                    this.#callback = callback;

                    this.#setStream( chunk );

                    this.#read();
                }
            }
            else {
                this.push( chunk );

                callback();
            }
        }

        _read ( size ) {
            if ( this.#stream ) {
                this.#read();
            }
            else {
                super._read( size );
            }
        }

        _destroy ( e, callback ) {
            this.#destroy();

            callback( e );
        }

        _setContentLength ( contentLength ) {
            if ( this.writableEnded ) {
                return this;
            }
            else {
                return super.setContentLength( contentLength );
            }
        }

        // private
        #read () {
            if ( this.#stream.readableLength ) {
                this.push( this.#stream.read() );
            }
            else {
                this.#stream.once( "readable", this.#readableListener );
            }
        }

        #onReadable () {
            const chunk = this.#stream.read();

            if ( chunk != null ) {
                this.push( chunk );
            }
        }

        #onError ( e ) {}

        #onClose () {
            const error = this.#stream.readableAborted
                ? this.#stream.errored || "Unexpected end of stream"
                : null;

            this.#setStream();

            const callback = this.#callback;
            this.#callback = null;

            callback( error );
        }

        #setStream ( stream ) {
            if ( this.#stream ) {
                this.#stream.off( "readable", this.#readableListener );
                this.#stream.off( "error", this.#errorListener );
                this.#stream.off( "close", this.#closeListener );

                this.#stream.setMaxListeners( this.#stream.getMaxListeners() - 1 );

                this.#stream = null;
            }

            if ( stream ) {
                stream.setMaxListeners( stream.getMaxListeners() + 1 );

                stream.once( "error", this.#errorListener );
                stream.once( "close", this.#closeListener );

                this.#stream = stream;
            }
        }

        #destroy () {

            // destroy buffered messages
            const messages = this.#messages;
            this.#messages = null;

            for ( const message of messages ) {
                message.destroy();
            }

            // destroy current stream
            if ( this.#stream ) {
                const stream = this.#stream;

                this.#setStream();

                stream.destroy();
            }

            this.#callback = null;
        }
    };

export default class StreamJoiner extends mixins( DelayedTransformMixin, StreamJoinerMixin ) {}
