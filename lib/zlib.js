import zlib from "node:zlib";
import Message from "#lib/message";
import stream from "#lib/stream";

const ALGORITHMS = {
    "brotli": {
        "compress": {
            "stream": zlib.createBrotliCompress,
            "buffer": zlib.brotliCompress,
        },
        "decompress": {
            "stream": zlib.createBrotliDecompress,
            "buffer": zlib.brotliDecompress,
        },
    },
    "deflate": {
        "compress": {
            "stream": zlib.createDeflate,
            "buffer": zlib.deflate,
        },
        "decompress": {
            "stream": zlib.createInflate,
            "buffer": zlib.inflate,
        },
    },
    "deflateRaw": {
        "compress": {
            "stream": zlib.createDeflateRaw,
            "buffer": zlib.deflateRaw,
        },
        "decompress": {
            "stream": zlib.createInflateRaw,
            "buffer": zlib.inflateRaw,
        },
    },
    "gunzip": {
        "compress": {
            "stream": zlib.createGzip,
            "buffer": zlib.gzip,
        },
        "decompress": {
            "stream": zlib.createGUnzip,
            "buffer": zlib.gunzip,
        },
    },
    "gzip": {
        "compress": {
            "stream": zlib.createGzip,
            "buffer": zlib.gzip,
        },
        "decompress": {
            "stream": zlib.createGUnzip,
            "buffer": zlib.gunzip,
        },
    },
    "inflate": {
        "compress": {
            "stream": zlib.createDeflate,
            "buffer": zlib.deflate,
        },
        "decompress": {
            "stream": zlib.createInflate,
            "buffer": zlib.inflate,
        },
    },
    "inflateRaw": {
        "compress": {
            "stream": zlib.createDeflateRaw,
            "buffer": zlib.deflateRaw,
        },
        "decompress": {
            "stream": zlib.createInflateRaw,
            "buffer": zlib.inflateRaw,
        },
    },
    "zip": {
        "compress": {
            "stream": zlib.createGzip,
            "buffer": zlib.gzip,
        },
        "decompress": {
            "stream": zlib.createUnip,
            "buffer": zlib.unzip,
        },
    },
    "zstd": {
        "compress": {
            "stream": zlib.createZstdCompress,
            "buffer": zlib.zstdCompress,
        },
        "decompress": {
            "stream": zlib.createZstdDecompress,
            "buffer": zlib.zstdDecompress,
        },
    },
};

export async function compress ( algorithm, message, zlibOptions ) {
    message = Message.new( message );

    const body = await message.createBody();

    // identity
    if ( algorithm === "identity" ) return body;

    const compressor = ALGORITHMS[ algorithm ]?.compress;
    if ( !compressor ) {
        message.destroy();

        throw new Error( "Compression algorithm is not valid" );
    }

    if ( !body ) {
        return;
    }
    else if ( Buffer.isBuffer( body ) ) {
        return new Promise( ( resolve, reject ) =>
            compressor.buffer( body, zlibOptions, ( e, data ) => {
                if ( e ) {
                    reject( e );
                }
                else {
                    resolve( data );
                }
            } ) );
    }
    else {
        return stream.pipeline( body, compressor.stream( zlibOptions ), e => {} );
    }
}

export async function decompress ( algorithm, message, zlibOptions ) {
    message = Message.new( message );

    const body = await message.createBody();

    // identity
    if ( algorithm === "identity" ) return body;

    const compressor = ALGORITHMS[ algorithm ]?.decompress;
    if ( !compressor ) {
        message.destroy();

        throw new Error( "Compression algorithm is not valid" );
    }

    if ( !body ) {
        return;
    }
    else if ( Buffer.isBuffer( body ) ) {
        return new Promise( ( resolve, reject ) =>
            compressor.buffer( body, zlibOptions, ( e, data ) => {
                if ( e ) {
                    reject( e );
                }
                else {
                    resolve( data );
                }
            } ) );
    }
    else {
        return stream.pipeline( body, compressor.stream( zlibOptions ), e => {} );
    }
}
