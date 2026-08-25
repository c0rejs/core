import Progress from "#lib/progress";
import stream from "#lib/stream";

export default class ProgressStream extends stream.Transform {
    #progress;

    constructor ( options ) {
        super( options );

        this.#progress = new Progress( {
            ...options,
            "bytes": !this.writableObjectMode,
        } );
    }

    // properties
    get progress () {
        return this.#progress;
    }

    // protected
    _transform ( chunk, encoding, callback ) {
        this.#progress.start().incrementValue( chunk.length );

        this.push( chunk, encoding );

        callback();
    }

    _flush ( callback ) {
        this.#progress.stop();

        callback();
    }
}
