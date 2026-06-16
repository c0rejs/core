const DEFAULT_BYTE_LENGTH = 1024; // max 0xFFFF

var DEFAULT_RANDOM_VALUES;

export default class RandomValues {
    #arrayBuffer;
    #uint8Array;
    #dataView;
    #byteOffset;

    constructor ( byteLength = DEFAULT_BYTE_LENGTH ) {
        this.#arrayBuffer = new ArrayBuffer( byteLength );
        this.#uint8Array = new Uint8Array( this.#arrayBuffer );
        this.#dataView = new DataView( this.#arrayBuffer );
        this.#byteOffset = Infinity;
    }

    // static
    static get default () {
        DEFAULT_RANDOM_VALUES ??= new this( DEFAULT_BYTE_LENGTH );

        return DEFAULT_RANDOM_VALUES;
    }

    // properties
    get byteLength () {
        return this.#arrayBuffer.byteLength;
    }

    // public
    getRandomInt ( min = 0, max = 0 ) {
        var bigint;

        if ( typeof min === "bigint" ) {
            bigint = true;
        }
        else {
            min = BigInt( min );
        }

        if ( typeof max === "bigint" ) {
            bigint = true;
        }
        else {
            max = BigInt( max );
        }

        // swap min / max
        if ( min > max ) {
            [ min, max ] = [ max, min ];
        }

        var value = 0n;

        const range = max - min;

        if ( range ) {
            let bitLength;

            if ( range <= Number.MAX_SAFE_INTEGER ) {
                bitLength = Math.trunc( Math.log2( Number( range ) ) + 1 );
            }
            else {
                const hexLen = range.toString( 16 ).length - 1,
                    bitLen = hexLen << 2,
                    topBits = 32 - Math.clz32( Number( range >> BigInt( bitLen ) ) );

                bitLength = bitLen + topBits;
            }

            while ( true ) {
                const bytes = this.getRandomUint8Array( Math.ceil( bitLength / 8 ) ),
                    bits = bitLength % 8;

                value = BigInt( bytes[ 0 ] );

                if ( bits ) {
                    value = value >> ( 8n - BigInt( bits ) );
                }

                for ( let n = 1; n < bytes.byteLength; n++ ) {
                    value = ( value << 8n ) | BigInt( bytes[ n ] );
                }

                if ( value <= range ) break;
            }
        }

        value += min;

        if ( !bigint ) {
            value = Number( value );
        }

        return value;
    }

    getRandomBinary () {
        this.#check( 1 );

        const value = this.#dataView.getUint8( this.#byteOffset );

        this.#byteOffset += 1;

        return value & 1;
    }

    getRandomInt8 () {
        this.#check( 1 );

        const value = this.#dataView.getInt8( this.#byteOffset );

        this.#byteOffset += 1;

        return value;
    }

    getRandomUint8 () {
        this.#check( 1 );

        const value = this.#dataView.getUint8( this.#byteOffset );

        this.#byteOffset += 1;

        return value;
    }

    getRandomInt16 () {
        this.#check( 2 );

        const value = this.#dataView.getInt16( this.#byteOffset );

        this.#byteOffset += 2;

        return value;
    }

    getRandomUint16 () {
        this.#check( 2 );

        const value = this.#dataView.getUint16( this.#byteOffset );

        this.#byteOffset += 2;

        return value;
    }

    getRandomInt32 () {
        this.#check( 4 );

        const value = this.#dataView.getInt32( this.#byteOffset );

        this.#byteOffset += 4;

        return value;
    }

    getRandomUint32 () {
        this.#check( 4 );

        const value = this.#dataView.getUint32( this.#byteOffset );

        this.#byteOffset += 4;

        return value;
    }

    getRandomInt53 () {
        return this.getRandomInt( Number.MIN_SAFE_INTEGER, Number.MAX_SAFE_INTEGER );
    }

    getRandomUint53 () {
        return this.getRandomInt( 0, Number.MAX_SAFE_INTEGER );
    }

    getRandomInt64 () {
        this.#check( 8 );

        const value = this.#dataView.getBigInt64( this.#byteOffset );

        this.#byteOffset += 8;

        return value;
    }

    getRandomUint64 () {
        this.#check( 8 );

        const value = this.#dataView.getBigUint64( this.#byteOffset );

        this.#byteOffset += 8;

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

    getRandomDigit () {
        while ( true ) {
            let byte = this.getRandomUint8(),
                digit;

            digit = byte & 0b1111;
            if ( digit <= 9 ) return digit;

            byte = byte >> 4;

            digit = byte & 0b1111;
            if ( digit <= 9 ) return digit;
        }
    }

    getRandomDigits ( length = 2 ) {
        const digits = [];

        while ( digits.length < length ) {
            let byte = this.getRandomUint8(),
                digit;

            digit = byte & 0b1111;
            if ( digit <= 9 ) digits.push( digit );

            if ( digits.length === length ) break;

            byte = byte >> 4;

            digit = byte & 0b1111;
            if ( digit <= 9 ) digits.push( digit );
        }

        return digits;
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
