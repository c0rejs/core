export default class RandomValues {
    #arrayBuffer;
    #uint8Array;
    #dataView;
    #byteOffset;

    constructor ( byteLength ) {
        this.#arrayBuffer = new ArrayBuffer( byteLength );
        this.#uint8Array = new Uint8Array( this.#arrayBuffer );
        this.#dataView = new DataView( this.#arrayBuffer );
        this.#byteOffset = Infinity;
    }

    // properties
    get byteLength () {
        return this.#arrayBuffer.byteLength;
    }

    // public
    getRandomInt ( min, max ) {
        const range = Math.abs( max - min );

        var value;

        if ( range <= 0xFF ) {
            value = this.getRandomUint8();
        }
        else if ( range <= 0xFFFF ) {
            value = this.getRandomUint16();
        }
        else if ( range <= 0xFFFF_FFFF ) {
            value = this.getRandomUint32();
        }
        else {
            throw new Error( "Range is too large" );
        }

        return min + ( value % range );
    }

    getRandomUint8 () {
        this.#check( 1 );

        const value = this.#dataView.getUint8( this.#byteOffset );

        this.#byteOffset += 1;

        return value;
    }

    getRandomUint16 () {
        this.#check( 2 );

        var value = this.#dataView.getUint16( this.#byteOffset );

        this.#byteOffset += 2;

        return value;
    }

    getRandomUint32 () {
        this.#check( 4 );

        var value = this.#dataView.getUint32( this.#byteOffset );

        this.#byteOffset += 4;

        return value;
    }

    getRandomUint8Array ( length ) {
        this.#check( length );

        const array = new Uint8Array( this.#arrayBuffer, this.#byteOffset, length );

        this.#byteOffset += length;

        return array;
    }

    getRandomUint16Array ( length ) {
        this.#byteOffset = Math.ceil( this.#byteOffset / 2 ) * 2;

        this.#check( length * 2 );

        const array = new Uint16Array( this.#arrayBuffer, this.#byteOffset, length );

        this.#byteOffset += length * 2;

        return array;
    }

    getRandomUint32Array ( length ) {
        this.#byteOffset = Math.ceil( this.#byteOffset / 4 ) * 4;

        this.#check( length * 4 );

        const array = new Uint32Array( this.#arrayBuffer, this.#byteOffset, length );

        this.#byteOffset += length * 4;

        return array;
    }

    // private
    #check ( byteLength ) {
        if ( byteLength > this.#arrayBuffer.byteLength ) throw new Error( "Read length is too large" );

        if ( this.#byteOffset + byteLength >= this.#arrayBuffer.byteLength ) {
            globalThis.crypto.getRandomValues( this.#uint8Array );

            this.#byteOffset = 0;
        }
    }
}
