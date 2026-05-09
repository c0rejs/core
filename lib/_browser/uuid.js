const UUIDV7_MAX_COUNTER = 2 ** 12 - 1,
    RANDOM_DATA = new Uint32Array( 1000 );

var UUIDV7_TIMESTAMP = 0,
    UUIDV7_COUNTER,
    RANDOM_DATA_START = RANDOM_DATA.length;

// public
export default uuidv4;

export function uuidv4 () {

    // for https context use built-in method
    if ( globalThis.crypto.randomUUID ) {
        return globalThis.crypto.randomUUID();
    }

    // fallback for insecure context
    else {
        const bytes = getRandomData( 4 );

        // set version (bits 48-51 to 0b0100)
        bytes[ 1 ] = ( bytes[ 1 ] & -0x1_F0_01 ) | 0x40_00;

        // set variant (bits 64-65 to 0b10)
        bytes[ 2 ] = ( bytes[ 2 ] & 0x3F_FF_FF_FF ) | 0x80_00_00_00;

        return (
            bytes[ 0 ].toString( 16 ).padStart( 8, "0" ) + //
            "-" +
            ( bytes[ 1 ] >>> 16 ).toString( 16 ).padStart( 4, "0" ) +
            "-" +
            ( bytes[ 1 ] & 0xFF_FF ).toString( 16 ).padStart( 4, "0" ) +
            "-" +
            ( bytes[ 2 ] >>> 16 ).toString( 16 ).padStart( 4, "0" ) +
            "-" +
            ( bytes[ 2 ] & 0xFF_FF ).toString( 16 ).padStart( 4, "0" ) +
            bytes[ 3 ].toString( 16 ).padStart( 8, "0" )
        );
    }
}

export function uuidv7 () {
    const timestamp = Date.now();

    // use new timestamp
    if ( timestamp > UUIDV7_TIMESTAMP ) {
        UUIDV7_TIMESTAMP = timestamp;
        UUIDV7_COUNTER = null;
    }

    if ( UUIDV7_COUNTER ) {
        UUIDV7_COUNTER += 1;

        if ( UUIDV7_COUNTER > UUIDV7_MAX_COUNTER ) {
            UUIDV7_TIMESTAMP += 1;

            UUIDV7_COUNTER = null;
        }
    }

    const bytes = new Array( 4 );

    // read counter
    if ( UUIDV7_COUNTER ) {
        const data = getRandomData( 2 );

        bytes[ 2 ] = data[ 0 ];
        bytes[ 3 ] = data[ 1 ];
    }
    else {
        const data = getRandomData( 3 );

        bytes[ 2 ] = data[ 0 ];
        bytes[ 3 ] = data[ 1 ];

        UUIDV7_COUNTER = bytes[ 2 ] & 0xF_FF;
    }

    // set 48-bit timestamp + version + counter
    bytes[ 0 ] = Number( BigInt( UUIDV7_TIMESTAMP ) >> 16n );
    bytes[ 1 ] = ( ( UUIDV7_TIMESTAMP & 0xFF_FF ) << 16 ) | 0x70_00 | UUIDV7_COUNTER;

    // set variant (bits 64-65 to 0b10)
    bytes[ 2 ] = ( bytes[ 2 ] & 0x3F_FF_FF_FF ) | 0x80_00_00_00;

    return (
        bytes[ 0 ].toString( 16 ).padStart( 8, "0" ) + //
        "-" +
        ( bytes[ 1 ] >>> 16 ).toString( 16 ).padStart( 4, "0" ) +
        "-" +
        ( bytes[ 1 ] & 0xFF_FF ).toString( 16 ).padStart( 4, "0" ) +
        "-" +
        ( bytes[ 2 ] >>> 16 ).toString( 16 ).padStart( 4, "0" ) +
        "-" +
        ( bytes[ 2 ] & 0xFF_FF ).toString( 16 ).padStart( 4, "0" ) +
        bytes[ 3 ].toString( 16 ).padStart( 8, "0" )
    );
}

// private
function getRandomData ( length ) {
    if ( RANDOM_DATA_START + length >= RANDOM_DATA.length ) {
        RANDOM_DATA_START = 0;

        globalThis.crypto.getRandomValues( RANDOM_DATA );
    }

    RANDOM_DATA_START += length;

    return RANDOM_DATA.subarray( RANDOM_DATA_START - length, RANDOM_DATA_START );
}
