import childProcess from "node:child_process";
import DigitalSize from "#lib/digital-size";
import Events from "#lib/events";
import externalResources from "#lib/external-resources";
import Interval from "#lib/interval";
import Message from "#lib/message";
import stream from "#lib/stream";

// NOTE: https://www.ffmpeg.org/ffmpeg.html

const PROGRESS_NUMBER_PROPERTIES = new Set( [ "total_size", "out_time_us", "out_time_ms", "dup_frames", "drop_frames" ] ),
    PROTECTED_OPTIONS = new Set( [ "hide_banner", "progress" ] ),
    FFMPEG_RESOURCE = await externalResources.add( "corejslib/core/resources/ffmpeg-" + process.platform ).check(),
    FFMPEG_EXECUTABLE_PATH = FFMPEG_RESOURCE.getResourcePath( "bin/ffmpeg" + ( process.platform === "win32"
        ? ".exe"
        : "" ) ),
    FFPROBE_EXECUTABLE_PATH = FFMPEG_RESOURCE.getResourcePath( "bin/ffprobe" + ( process.platform === "win32"
        ? ".exe"
        : "" ) );

export default class Ffmpeg {
    #events = new Events();
    #options = {
        "hide_banner": null,
        "loglevel": "error", // error, quiet
        "progress": "pipe:3",
    };
    #input = [];
    #output = [];
    #proc;
    #fd = 4;

    constructor ( args ) {
        for ( const arg of args ) {
            if ( arg.input ) {
                this.#addInput( arg );
            }
            else if ( arg.output ) {
                this.#addOutput( arg );
            }
            else {
                this.#addOptions( arg, this.#options );
            }
        }
    }

    // static
    static new ( ...args ) {
        if ( args[ 0 ] instanceof this ) {
            return args[ 0 ];
        }
        else {
            return new this( args );
        }
    }

    static async probe ( message ) {
        const args = [ "-v", "quiet", "-show_format", "-show_streams", "-print_format", "json" ],
            stdio = [ "ignore", "pipe", "ignore" ];

        message = Message.new( message );

        if ( message.isRealFileBody ) {
            args.push( "-i", message.body.path );
        }
        else {
            args.push( "-i", "pipe:0" );
            stdio[ 0 ] = "pipe";
        }

        const proc = childProcess.spawn( FFPROBE_EXECUTABLE_PATH, args, {
            "encoding": "buffer",
            stdio,
        } );

        // pipe input
        if ( stdio[ 0 ] === "pipe" ) {
            stream.pipeline( message.createBodyStreamSync(), proc.stdio[ 0 ], e => {} );
        }

        return new Promise( resolve => {
            proc.once( "error", e => resolve( result.fromError( e, { "log": false } ) ) );

            // process output json
            proc.stdout
                .json()
                .then( data => {
                    if ( !data.format ) return resolve( result( 200 ) );

                    data = {
                        ...data.format,
                        "streams": data.streams,
                    };

                    if ( data.duration ) data.duration = new Interval( Number( data.duration ), "seconds" );
                    if ( data.start_time ) data.start_time = new Interval( Number( data.start_time ), "seconds" );
                    if ( data.size ) data.size = new DigitalSize( data.size );

                    if ( data.streams ) {
                        for ( const stream of data.streams ) {
                            if ( stream.duration ) stream.duration = new Interval( Number( stream.duration ), "seconds" );
                            if ( stream.start_time ) stream.start_time = new Interval( Number( stream.start_time ), "seconds" );
                            if ( stream.is_avc ) stream.is_avc = Boolean( stream.is_avc );
                            if ( stream.nal_length_size ) data.nal_length_size = Number( stream.nal_length_size );
                            if ( stream.bit_rate ) stream.bit_rate = Number( stream.bit_rate );
                            if ( stream.sample_rate ) stream.sample_rate = Number( stream.sample_rate );
                            if ( stream.nb_frames ) stream.nb_frames = Number( stream.nb_frames );
                        }
                    }

                    resolve( result( 200, data ) );
                } )
                .catch( e => {
                    resolve( result.fromError( e, { "log": false } ) );
                } );
        } );
    }

    // public
    async exec ( { signal } = {} ) {
        const args = [],
            stdio = [ "ignore", "ignore", "inherit", "pipe" ];

        // global options
        for ( const [ key, value ] of Object.entries( this.#options ) ) {
            if ( value === undefined ) {
                continue;
            }
            else if ( Array.isArray( value ) ) {
                const values = value;

                for ( const value of values ) {
                    args.push( `-${ key }` );

                    if ( value != null ) {
                        args.push( value );
                    }
                }
            }
            else {
                args.push( `-${ key }` );

                if ( value != null ) {
                    args.push( value );
                }
            }
        }

        // files
        for ( const files of [ this.#input, this.#output ] ) {
            for ( const file of files ) {
                for ( const [ key, value ] of Object.entries( file.options ) ) {
                    if ( value === undefined ) continue;

                    args.push( "-" + key );

                    if ( value != null ) args.push( value );
                }

                // input
                if ( file.type === "input" ) {
                    if ( file.fd ) {
                        args.push( "-i", `pipe:${ file.fd }` );

                        stdio.push( "pipe" );
                    }
                    else {
                        args.push( "-i", file.message.body.path );
                    }
                }

                // output
                else {
                    if ( file.fd ) {
                        args.push( `pipe:${ file.fd }` );

                        stdio.push( "pipe" );
                    }
                    else {
                        args.push( file.message.body.path );
                    }
                }
            }
        }

        // create ffmpeg process
        try {
            this.#proc = childProcess.spawn( FFMPEG_EXECUTABLE_PATH, args, {
                stdio,
                signal,
            } );
        }
        catch ( e ) {
            return result.fromError( e, { "log": false } );
        }

        // pipe progress
        this.#proc.stdio[ 3 ].on( "data", this.#onProgress.bind( this ) );

        // pipe output
        for ( const file of this.#output ) {
            if ( file.fd ) {
                stream.pipeline( this.#proc.stdio[ file.fd ], file.message.body, e => {} );
            }
        }

        // pipe input
        for ( const file of this.#input ) {
            if ( file.fd ) {
                stream.pipeline( await file.message.createBodyStream(), this.#proc.stdio[ file.fd ], e => {} );
            }
        }

        return new Promise( resolve => {
            this.#proc.once( "close", code => {
                this.#proc = null;

                if ( code ) {
                    resolve( result( 500 ) );
                }
                else {
                    resolve( result( 200, {
                        "output": this.#output.map( file => file.message ),
                    } ) );
                }
            } );
        } );
    }

    on ( event, callback ) {
        this.#events.on( event, callback );

        return this;
    }

    once ( event, callback ) {
        this.#events.once( event, callback );

        return this;
    }

    off ( event, callback ) {
        this.#events.off( event, callback );

        return this;
    }

    // private
    #addOptions ( options, target ) {
        for ( const [ key, value ] of Object.entries( options ) ) {
            if ( PROTECTED_OPTIONS.has( key ) ) continue;

            if ( value === undefined ) {
                delete target[ key ];
            }
            else {
                target[ key ] = value;
            }
        }
    }

    #addInput ( { input, ...options } ) {
        const file = {
            "type": "input",
            "message": null,
            "options": {},
            "fd": null,
        };

        this.#input.push( file );

        this.#addOptions( options, file.options );

        this.#addMessage( file, input );
    }

    #addOutput ( { output, ...options } ) {
        const file = {
            "type": "output",
            "message": null,
            "options": {},
            "fd": null,
        };

        this.#output.push( file );

        this.#addOptions( options, file.options );

        this.#addMessage( file, output );
    }

    #addMessage ( file, message ) {
        message = Message.new( message );

        file.message = message;

        if ( !message.isRealFileBody ) {
            if ( file.type === "output" && !( message.body instanceof stream.Transform ) ) {
                throw new TypeError( "Output type is not valid. It can be a instance of File or stream.Transform." );
            }

            file.fd = this.#fd++;
        }
    }

    #onProgress ( buffer ) {
        if ( !this.#events.hasListeners( "progress" ) ) return;

        const data = {};

        for ( const line of buffer.toString().split( "\n" ) ) {
            let [ key, value ] = line.split( "=", 2 );

            key = key.trim();

            if ( !key ) continue;

            value = value.trim();

            if ( PROGRESS_NUMBER_PROPERTIES.has( key ) ) {
                value = Number( value );
            }

            data[ key ] = value;
        }

        this.#events.emit( "progress", data );
    }
}
