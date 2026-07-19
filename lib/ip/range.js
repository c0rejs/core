import IpAddress from "#lib/ip/address";
import Range from "#lib/range";

const PARSING_ERROR_MESSAGE = "IP range is invalid",
    V4_MASKS = { "0": {}, "1": {} },
    V6_MASKS = { "0": {}, "1": {} };

export default class IpRange {
    #id;
    #firstAddress;
    #lastAddress;
    #prefix;
    #string;
    #rangeString;
    #cidrString;
    #range;

    constructor ( range, prefix ) {

        // ip range, make a copy
        if ( range instanceof this.constructor ) {
            this.#firstAddress = range.firstAddress;
            this.#lastAddress = range.lastAddress;
        }

        // array of ip addresses
        else if ( Array.isArray( range ) ) {
            this.#firstAddress = range[ 0 ];
            this.#lastAddress = range[ 1 ];
        }

        // range string
        else if ( typeof range === "string" && range.includes( "-" ) ) {
            const idx = range.indexOf( "-" );

            this.#firstAddress = new IpAddress( range.slice( 0, idx ) );
            this.#lastAddress = new IpAddress( range.slice( idx + 1 ) );

            if ( this.#firstAddress.isIpV4 && !this.#lastAddress.isIpV4 ) throw new Error( PARSING_ERROR_MESSAGE );

            // swap first <-> last
            if ( this.#firstAddress.value > this.#lastAddress.value ) [ this.#firstAddress, this.#lastAddress ] = [ this.#lastAddress, this.#firstAddress ];
        }

        // cidr or value or ip address
        else {

            // string
            if ( typeof range === "string" ) {
                const idx = range.indexOf( "/" );

                // cidr string
                if ( idx > 0 ) {
                    prefix ??= +range.slice( idx + 1 );
                    range = new IpAddress( range.slice( 0, idx ) );
                }

                // single ip address
                else {
                    range = new IpAddress( range );
                }
            }

            // value
            else if ( typeof range === "number" || typeof range === "bigint" ) {
                range = new IpAddress( range );
            }

            // ip address
            if ( range instanceof IpAddress ) {

                // v4
                if ( range.isIpV4 ) {

                    // check prefix
                    if ( prefix == null ) {
                        prefix = 32;
                    }
                    else if ( Number.isNaN( prefix ) || prefix < 0 || prefix > 32 ) {
                        throw new Error( PARSING_ERROR_MESSAGE );
                    }

                    if ( prefix === 32 ) {
                        this.#firstAddress = range;
                        this.#lastAddress = range;
                    }
                    else {
                        if ( !V4_MASKS[ "0" ][ prefix ] ) {
                            V4_MASKS[ "0" ][ prefix ] = Number( "0b" + "1".repeat( prefix ) + "0".repeat( 32 - prefix ) );
                        }
                        this.#firstAddress = new IpAddress( ( range.value & V4_MASKS[ "0" ][ prefix ] ) >>> 0 );

                        if ( !V4_MASKS[ "1" ][ prefix ] ) {
                            V4_MASKS[ "1" ][ prefix ] = Number( "0b" + "0".repeat( prefix ) + "1".repeat( 32 - prefix ) );
                        }
                        this.#lastAddress = new IpAddress( ( range.value | V4_MASKS[ "1" ][ prefix ] ) >>> 0 );
                    }
                }

                // v6
                else {

                    // check prefix
                    if ( prefix == null ) {
                        prefix = 128;
                    }
                    else if ( Number.isNaN( prefix ) || prefix < 0 || prefix > 128 ) {
                        throw new Error( PARSING_ERROR_MESSAGE );
                    }

                    if ( prefix === 128 ) {
                        this.#firstAddress = range;
                        this.#lastAddress = range;
                    }
                    else {
                        if ( !V6_MASKS[ "0" ][ prefix ] ) {
                            V6_MASKS[ "0" ][ prefix ] = BigInt( "0b" + "1".repeat( prefix ) + "0".repeat( 128 - prefix ) );
                        }
                        this.#firstAddress = new IpAddress( range.value & V6_MASKS[ "0" ][ prefix ] );

                        if ( !V6_MASKS[ "1" ][ prefix ] ) {
                            V6_MASKS[ "1" ][ prefix ] = BigInt( "0b" + "0".repeat( prefix ) + "1".repeat( 128 - prefix ) );
                        }
                        this.#lastAddress = new IpAddress( range.value | V6_MASKS[ "1" ][ prefix ] );
                    }
                }

                this.#prefix = prefix;
            }

            // invalid type
            else {
                throw new Error( PARSING_ERROR_MESSAGE );
            }
        }
    }

    // static
    static new ( range, prefix ) {
        if ( range instanceof this ) {
            return range;
        }
        else {
            return new this( range, prefix );
        }
    }

    static isValid ( range, prefix ) {
        try {
            new this( range, prefix );

            return true;
        }
        catch {
            return false;
        }
    }

    static get compare () {
        return ( a, b ) => this.new( a ).compare( b );
    }

    // properties
    get id () {
        if ( !this.#id ) {
            this.#id = `${ this.firstAddress.id }-${ this.lastAddress.id }`;
        }

        return this.#id;
    }

    get family () {
        return this.#firstAddress.family;
    }

    get isIpV4 () {
        return this.#firstAddress.isIpV4;
    }

    get isIpV6 () {
        return this.#firstAddress.isIpV6;
    }

    get firstAddress () {
        return this.#firstAddress;
    }

    get lastAddress () {
        return this.#lastAddress;
    }

    get size () {
        if ( this.isIpV4 ) {
            return this.#lastAddress.value - this.#firstAddress.value + 1;
        }
        else {
            return this.#lastAddress.value - this.#firstAddress.value + 1n;
        }
    }

    get isCidrAble () {
        return this.prefix !== null;
    }

    get prefix () {
        if ( this.#prefix === undefined ) {
            const isIpV4 = this.#firstAddress.isIpV4;

            if ( this.#firstAddress.value === this.#lastAddress.value ) {
                this.#prefix = isIpV4
                    ? 32
                    : 128;
            }
            else {
                const maxBits = isIpV4
                    ? 32
                    : 128;
                const first = this.#firstAddress.value;
                const last = this.#lastAddress.value;

                // find common prefix length by bit comparison
                let prefix = 0;
                let xor = first ^ last;

                // count leading zeros in xor result
                if ( isIpV4 ) {
                    xor = xor >>> 0; // ensure 32-bit
                    while ( prefix < maxBits && !( xor & ( 1 << ( maxBits - 1 - prefix ) ) ) ) {
                        prefix++;
                    }
                }
                else {
                    while ( prefix < maxBits && !( xor & ( 1n << BigInt( maxBits - 1 - prefix ) ) ) ) {
                        prefix++;
                    }
                }

                // verify remaining bits match CIDR pattern (0...01...1)
                let allOnes = true;
                for ( let n = prefix; n < maxBits; n++ ) {
                    const bit = isIpV4
                        ? ( last >> ( maxBits - 1 - n ) ) & 1
                        : ( last >> BigInt( maxBits - 1 - n ) ) & 1n;

                    if ( bit === 0n || bit === 0 ) {
                        allOnes = false;
                        break;
                    }
                }

                this.#prefix = allOnes
                    ? prefix
                    : null;
            }
        }

        return this.#prefix;
    }

    get range () {
        if ( !this.#range ) {
            this.#range = new Range( {
                "name": this.id,
                "start": this.#firstAddress.value,
                "end": this.#lastAddress.value,
                "inclusive": true,
            } );
        }

        return this.#range;
    }

    // public
    toString () {
        if ( this.#string === undefined ) {
            this.#string = this.prefix !== null
                ? this.toCidrString()
                : this.toRangeString();
        }

        return this.#string;
    }

    toJSON () {
        return this.toString();
    }

    toRangeString () {
        this.#rangeString ??= this.#firstAddress + "-" + this.#lastAddress;

        return this.#rangeString;
    }

    toCidrString () {
        if ( this.#cidrString === undefined ) {
            this.#cidrString = this.prefix === null
                ? null
                : `${ this.#firstAddress }/${ this.prefix }`;
        }

        return this.#cidrString;
    }

    getRandomAddress () {
        return new IpAddress( this.range.getRandomValue() );
    }

    isIntersecting ( ipRange ) {
        ipRange = this.constructor.new( ipRange );

        if ( this.family !== ipRange.family ) return false;

        // first address in range
        if ( this.firstAddress.value >= ipRange.firstAddress.value && this.firstAddress.value <= ipRange.lastAddress.value ) return true;

        // last address in range
        if ( this.lastAddress.value >= ipRange.firstAddress.value && this.lastAddress.value <= ipRange.lastAddress.value ) return true;

        return false;
    }

    isCovering ( ipRange ) {
        ipRange = this.constructor.new( ipRange );

        if ( this.family !== ipRange.family ) return false;

        return ipRange.firstAddress.value >= this.firstAddress.value && ipRange.lastAddress.value <= this.lastAddress.value;
    }

    isCoveredBy ( ipRange ) {
        ipRange = this.constructor.new( ipRange );

        if ( this.family !== ipRange.family ) return false;

        return this.firstAddress.value >= ipRange.firstAddress.value && this.lastAddress.value <= ipRange.lastAddress.value;
    }

    isConsecutiveWith ( ipRange ) {
        ipRange = this.constructor.new( ipRange );

        if ( this.family !== ipRange.family ) return false;

        const nextAddress = this.lastAddress.nextAddress;
        if ( nextAddress && nextAddress.value === ipRange.firstAddress.value ) return true;

        const previousAddress = this.firstAddress.previousAddress;
        if ( previousAddress && previousAddress.value === ipRange.lastAddress.value ) return true;

        return false;
    }

    concat ( ipRange ) {
        ipRange = this.constructor.new( ipRange );

        if ( this.isCovering( ipRange ) ) {
            return this;
        }
        else if ( this.isCoveredBy( ipRange ) ) {
            return ipRange;
        }
        else if ( this.isIntersecting( ipRange ) || this.isConsecutiveWith( ipRange ) ) {
            return new this.constructor( [ this.firstAddress.value < ipRange.firstAddress.value
                ? this.firstAddress
                : ipRange.firstAddress, this.lastAddress.value > ipRange.lastAddress.value
                ? this.lastAddress
                : ipRange.lastAddress ] );
        }
        else {
            throw new Error( "Cannot concatenate IP ranges" );
        }
    }

    compare ( ipRange ) {
        ipRange = this.constructor.new( ipRange );

        return this.firstAddress.compare( ipRange.firstAddress ) || this.lastAddress.compare( ipRange.lastAddress );
    }

    eq ( ipRange ) {
        return this.compare( ipRange ) === 0;
    }

    ne ( ipRange ) {
        return this.compare( ipRange ) !== 0;
    }

    lt ( ipRange ) {
        return this.compare( ipRange ) < 0;
    }

    lte ( ipRange ) {
        return this.compare( ipRange ) <= 0;
    }

    gt ( ipRange ) {
        return this.compare( ipRange ) > 0;
    }

    gte ( ipRange ) {
        return this.compare( ipRange ) >= 0;
    }

    [ Symbol.for( "nodejs.util.inspect.custom" ) ] ( depth, options, inspect ) {
        const spec = this.toString();

        return `${ this.constructor.name }: ${ inspect( spec ) }`;
    }
}
