var UUIDV7_TIMESTAMP = 0,
    UUIDV7_COUNTER;

const UUIDV7_MAX_COUNTER = 2 ** 12 - 1;

export default uuidv4;

export function uuidv4 () {

    // for https context use built-in method
    if ( globalThis.crypto.randomUUID ) {
        return globalThis.crypto.randomUUID();
    }

    // fallback for insecure context
    else {
        const bytes = globalThis.crypto.getRandomValues( new Uint8Array( 16 ) );

        // set version (bits 48-51 to 0b0100)
        bytes[ 6 ] = ( bytes[ 6 ] & 0x0F ) | 0x40;

        // set variant (bits 64-65 to 0b10)
        bytes[ 8 ] = ( bytes[ 8 ] & 0x3F ) | 0x80;

        // convert to uuid string
        return [ ...bytes ].map( ( byte, idx ) => ( idx === 4 || idx === 6 || idx === 8 || idx === 10
            ? "-"
            : "" ) + byte.toString( 16 ).padStart( 2, "0" ) ).join( "" );
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

    const bytes = new Uint8Array( 16 );

    if ( UUIDV7_COUNTER ) {
        globalThis.crypto.getRandomValues( bytes.subarray( 8 ) );

        // write counter
        bytes[ 6 ] = ( bytes[ 6 ] & 0xF0 ) | ( ( UUIDV7_COUNTER >> 8 ) & 0x0F );
        bytes[ 7 ] = UUIDV7_COUNTER & 0xFF;
    }
    else {
        globalThis.crypto.getRandomValues( bytes.subarray( 6 ) );

        // read counter
        UUIDV7_COUNTER = ( ( bytes[ 6 ] & 0x0F ) << 8 ) | bytes[ 7 ];
    }

    // set 48-bit timestamp
    const timestampBytes = new Uint8Array( new BigUint64Array( [ BigInt( UUIDV7_TIMESTAMP ) ] ).buffer ).reverse();
    bytes.set( timestampBytes.slice( 2, 8 ), 0 );

    // set version (bits 48-51 to 0b0111)
    bytes[ 6 ] = ( bytes[ 6 ] & 0x0F ) | 0x70;

    // set variant (bits 64-65 to 0b10)
    bytes[ 8 ] = ( bytes[ 8 ] & 0x3F ) | 0x80;

    // convert to uuid string
    return [ ...bytes ].map( ( byte, idx ) => ( idx === 4 || idx === 6 || idx === 8 || idx === 10
        ? "-"
        : "" ) + byte.toString( 16 ).padStart( 2, "0" ) ).join( "" );
}
