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
    const bytes = new Uint8Array( 16 );

    globalThis.crypto.getRandomValues( bytes.subarray( 6 ) );

    // set 48-bit timestamp
    const timestampBytes = new Uint8Array( new BigUint64Array( [ BigInt( Date.now() ) ] ).buffer ).reverse();
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
