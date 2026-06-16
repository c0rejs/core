import DECIMAL from "decimal.js";
import RandomValues from "#lib/crypto/random-values";

const DEFAULT_PRECISION = 32,
    DECIMAL_ACCESSOR = Symbol(),
    ROUNDING_MODE = Object.freeze( {
        "DEFAULT": DECIMAL.ROUND_HALF_UP,
        "MATH": DECIMAL.ROUND_HALF_CEIL, // like Math.round()
        "UP": DECIMAL.ROUND_UP, // rounds away from zero
        "DOWN": DECIMAL.ROUND_DOWN, // rounds towards zero
        "CEIL": DECIMAL.ROUND_CEIL, // rounds towards Infinity
        "FLOOR": DECIMAL.ROUND_FLOOR, // rounds towards -Infinity
        "HALF_UP": DECIMAL.ROUND_HALF_UP,
        "HALF_DOWN": DECIMAL.ROUND_HALF_DOWN,
        "HALF_EVEN": DECIMAL.ROUND_HALF_EVEN,
        "HALF_CEIL": DECIMAL.ROUND_HALF_CEIL,
        "HALF_FLOOR": DECIMAL.ROUND_HALF_FLOOR,
    } ),
    ROUNDING_MODE_VALUES = new Set( Object.values( ROUNDING_MODE ) ),
    MODULO_MODE = Object.freeze( {
        "DEFAULT": ROUNDING_MODE.DOWN,
        "UP": ROUNDING_MODE.UP,
        "DOWN": ROUNDING_MODE.DOWN,
        "FLOOR": ROUNDING_MODE.FLOOR,
        "HALF_EVEN": ROUNDING_MODE.HALF_EVEN,
        "EUCLID": DECIMAL.EUCLID,
    } ),
    MODULO_MODE_VALUES = new Set( Object.values( MODULO_MODE ) ),
    NUMERICS = {},
    DECIMALS = new Map();

function getDecimal ( precision, roundingMode, moduloMode ) {
    precision ||= DEFAULT_PRECISION;
    roundingMode ??= ROUNDING_MODE.DEFAULT;
    moduloMode ??= MODULO_MODE.DEFAULT;

    const id = precision + "/" + roundingMode + "/" + moduloMode;

    var decimal = DECIMALS.get( id );

    if ( !decimal ) {
        decimal = DECIMAL.clone( {
            "defaults": true,
            precision,
            "minE": -9e15,
            "maxE": 9e15,
            "toExpNeg": -9e15,
            "toExpPos": 9e15,
            "rounding": roundingMode,
            "modulo": moduloMode,
            "crypto": false,
        } );

        DECIMALS.set( id, decimal );
    }

    return decimal;
}

function isNumeric ( value ) {
    return value instanceof Numeric;
}

function prepareDecimalValue ( value ) {
    if ( isNumeric( value ) ) {
        return value[ DECIMAL_ACCESSOR ];
    }
    else if ( typeof value === "bigint" ) {
        return value.toString();
    }
    else {
        return value;
    }
}

export default class Numeric {
    #SCALE;
    #MAX_INTEGER;
    #DECIMAL;
    #precision;
    #scale;
    #isNaN;
    #isFinite;
    #isInteger;
    #number;
    #bigint;
    #abs;
    #negated;
    #rounded;
    #truncated;
    #floored;
    #ceiled;
    #decimal;
    #string = {};
    #value;
    #bin;
    #hex;
    #oct;
    #sqrt;
    #cbrt;
    #exp;

    constructor ( value, { precision, scale, roundingMode, moduloMode } = {} ) {
        this.#SCALE = scale ?? null;

        if ( value == null ) {
            this.#DECIMAL = getDecimal( precision, roundingMode, moduloMode )( 0 );
        }
        else if ( value instanceof Numeric ) {
            this.#DECIMAL = value[ DECIMAL_ACCESSOR ];
        }
        else if ( DECIMAL.isDecimal( value ) ) {
            this.#DECIMAL = value;
        }
        else if ( typeof value === "bigint" ) {
            this.#DECIMAL = getDecimal( precision, roundingMode, moduloMode )( value.toString() );
        }
        else {
            this.#DECIMAL = getDecimal( precision, roundingMode, moduloMode )( value );
        }

        // check precision
        this.#DECIMAL = this.#toPrecision( this.#DECIMAL, precision, this.#SCALE, roundingMode, moduloMode );
    }

    // static
    static new ( value, { precision = DEFAULT_PRECISION, scale, roundingMode, moduloMode } = {} ) {
        if ( value instanceof this ) {
            scale ||= null;
            roundingMode ??= ROUNDING_MODE.DEFAULT;
            moduloMode ??= MODULO_MODE.DEFAULT;

            if ( precision === value.PRECISION && scale === value.SCALE && roundingMode === value.ROUNDING_MODE && moduloMode === value.MODULO_MODE ) {
                return value;
            }
        }

        return new this( value, { precision, scale, roundingMode, moduloMode } );
    }

    static get compare () {
        return ( a, b ) => this.new( a ).compare( b );
    }

    static get ROUNDING_MODE () {
        return ROUNDING_MODE;
    }

    static get MODULO_MODE () {
        return MODULO_MODE;
    }

    static get MAX_PRECISION () {
        return 1e9;
    }

    static get DEFAULT_PRECISION () {
        return DEFAULT_PRECISION;
    }

    static get INT8_PRECISION () {
        return 3;
    }

    static get INT16_PRECISION () {
        return 5;
    }

    static get INT32_PRECISION () {
        return 10;
    }

    static get INT53_PRECISION () {
        return 16;
    }

    static get INT64_PRECISION () {
        return 20;
    }

    static get INT128_PRECISION () {
        return 40;
    }

    static get MIN_INT8 () {
        NUMERICS.MIN_INT8 ??= this.MAX_UINT8.add( 1 ).divide( 2 ).negated;

        return NUMERICS.MIN_INT8;
    }

    static get MAX_INT8 () {
        NUMERICS.MAX_INT8 ??= this.MAX_UINT8.subtract( 1 ).divide( 2 );

        return NUMERICS.MAX_INT8;
    }

    static get MAX_UINT8 () {
        NUMERICS.MAX_UINT8 ??= new this( 0xFF, {
            "precision": this.INT8_PRECISION,
        } );

        return NUMERICS.MAX_UINT8;
    }

    static get MIN_INT16 () {
        NUMERICS.MIN_INT16 ??= this.MAX_UINT16.add( 1 ).divide( 2 ).negated;

        return NUMERICS.MIN_INT16;
    }

    static get MAX_INT16 () {
        NUMERICS.MAX_INT16 ??= this.MAX_UINT16.subtract( 1 ).divide( 2 );

        return NUMERICS.MAX_INT16;
    }

    static get MAX_UINT16 () {
        NUMERICS.MAX_UINT16 ??= new this( 0xFFFF, {
            "precision": this.INT16_PRECISION,
        } );

        return NUMERICS.MAX_UINT16;
    }

    static get MIN_INT32 () {
        NUMERICS.MIN_INT32 ??= this.MAX_UINT32.add( 1 ).divide( 2 ).negated;

        return NUMERICS.MIN_INT32;
    }

    static get MAX_INT32 () {
        NUMERICS.MAX_INT32 ??= this.MAX_UINT32.subtract( 1 ).divide( 2 );

        return NUMERICS.MAX_INT32;
    }

    static get MAX_UINT32 () {
        NUMERICS.MAX_UINT32 ??= new this( 0xFFFF_FFFF, {
            "precision": this.INT32_PRECISION,
        } );

        return NUMERICS.MAX_UINT32;
    }

    static get MIN_INT53 () {
        return this.MAX_UINT53.negated;
    }

    static get MAX_INT53 () {
        return this.MAX_UINT53;
    }

    static get MAX_UINT53 () {
        NUMERICS.MAX_UINT53 ??= new this( Number.MAX_SAFE_INTEGER, {
            "precision": this.INT53_PRECISION,
        } );

        return NUMERICS.MAX_UINT53;
    }

    static get MIN_INT64 () {
        NUMERICS.MIN_INT64 ??= this.MAX_UINT64.add( 1 ).divide( 2 ).negated;

        return NUMERICS.MIN_INT64;
    }

    static get MAX_INT64 () {
        NUMERICS.MAX_INT64 ??= this.MAX_UINT64.subtract( 1 ).divide( 2 );

        return NUMERICS.MAX_INT64;
    }

    static get MAX_UINT64 () {
        NUMERICS.MAX_UINT64 ??= new this( "0xFFFFFFFFFFFFFFFF", {
            "precision": this.INT64_PRECISION,
        } );

        return NUMERICS.MAX_UINT64;
    }

    static get MIN_INT128 () {
        NUMERICS.MIN_INT128 ??= this.MAX_UINT128.add( 1 ).divide( 2 ).negated;

        return NUMERICS.MIN_INT128;
    }

    static get MAX_INT128 () {
        NUMERICS.MAX_INT128 ??= this.MAX_UINT128.subtract( 1 ).divide( 2 );

        return NUMERICS.MAX_INT128;
    }

    static get MAX_UINT128 () {
        NUMERICS.MAX_UINT128 ??= new this( "0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF", {
            "precision": this.INT128_PRECISION,
        } );

        return NUMERICS.MAX_UINT128;
    }

    static isNumeric ( value ) {
        return isNumeric( value );
    }

    static isNaN ( value ) {
        if ( this.isNumeric( value ) ) {
            return value.isNaN;
        }
        else {
            return Number.isNaN( value );
        }
    }

    static isFinite ( value ) {
        if ( this.isNumeric( value ) ) {
            return value.isFinite;
        }
        else {
            return Number.isFinite( value );
        }
    }

    static isInteger ( value ) {
        if ( this.isNumeric( value ) ) {
            return value.isInteger;
        }
        else {
            return Number.isInteger( value );
        }
    }

    static isSafeInteger ( value ) {
        if ( this.isNumeric( value ) ) {
            return value.isSafeInteger;
        }
        else {
            return Number.isSafeInteger( value );
        }
    }

    static max ( ...args ) {
        var res = null;

        for ( let arg of args ) {
            if ( arg == null ) {
                continue;
            }

            if ( !isNumeric( arg ) ) {
                arg = new this( arg );
            }

            if ( arg.isNaN ) {
                continue;
            }
            else if ( res == null ) {
                res = arg;
            }
            else if ( arg[ DECIMAL_ACCESSOR ].greaterThan( res[ DECIMAL_ACCESSOR ] ) ) {
                res = arg;
            }
        }

        return res;
    }

    static min ( ...args ) {
        var res = null;

        for ( let arg of args ) {
            if ( arg == null ) {
                continue;
            }

            if ( !isNumeric( arg ) ) {
                arg = new this( arg );
            }

            if ( arg.isNaN ) {
                continue;
            }
            else if ( res == null ) {
                res = arg;
            }
            else if ( arg[ DECIMAL_ACCESSOR ].lessThan( res[ DECIMAL_ACCESSOR ] ) ) {
                res = arg;
            }
        }

        return res;
    }

    static getRandomNumeric ( { minPrecision, maxPrecision, scale } = {} ) {
        minPrecision ||= 0;
        maxPrecision ||= DEFAULT_PRECISION;

        if ( minPrecision > maxPrecision ) {
            [ minPrecision, maxPrecision ] = [ maxPrecision, minPrecision ];
        }

        const min = minPrecision
                ? 10n ** ( BigInt( minPrecision ) - 1n )
                : 0n,
            max = 10n ** BigInt( maxPrecision ) - 1n;

        var value = RandomValues.default.getRandomInt( min, max );

        if ( scale ) {
            value = new this( value, {
                "precision": maxPrecision,
            } ).divide( 10 ** scale );
        }

        return new this( value, {
            "precision": maxPrecision,
            scale,
        } );
    }

    static getRandomInt ( { min, max, precision } = {} ) {
        return new this( RandomValues.default.getRandomInt( min, max ), {
            precision,
        } );
    }

    static getRandomBinary ( { precision } = {} ) {
        return new this( RandomValues.default.getRandomBinary(), {
            "precision": precision || this.INT8_PRECISION,
        } );
    }

    static getRandomInt8 ( { precision } = {} ) {
        return new this( RandomValues.default.getRandomInt8(), {
            "precision": precision || this.INT8_PRECISION,
        } );
    }

    static getRandomUint8 ( { precision } = {} ) {
        return new this( RandomValues.default.getRandomUint8(), {
            "precision": precision || this.INT8_PRECISION,
        } );
    }

    static getRandomInt16 ( { precision } = {} ) {
        return new this( RandomValues.default.getRandomInt16(), {
            "precision": precision || this.INT16_PRECISION,
        } );
    }

    static getRandomUint16 ( { precision } = {} ) {
        return new this( RandomValues.default.getRandomUint16(), {
            "precision": precision || this.INT16_PRECISION,
        } );
    }

    static getRandomInt32 ( { precision } = {} ) {
        return new this( RandomValues.default.getRandomInt32(), {
            "precision": precision || this.INT32_PRECISION,
        } );
    }

    static getRandomUint32 ( { precision } = {} ) {
        return new this( RandomValues.default.getRandomUint32(), {
            "precision": precision || this.INT32_PRECISION,
        } );
    }

    static getRandomInt53 ( { precision } = {} ) {
        return new this( RandomValues.default.getRandomInt53(), {
            "precision": precision || this.INT53_PRECISION,
        } );
    }

    static getRandomUint53 ( { precision } = {} ) {
        return new this( RandomValues.default.getRandomUint53(), {
            "precision": precision || this.INT53_PRECISION,
        } );
    }

    static getRandomInt64 ( { precision } = {} ) {
        return new this( RandomValues.default.getRandomInt64(), {
            "precision": precision || this.INT64_PRECISION,
        } );
    }

    static getRandomUint64 ( { precision } = {} ) {
        return new this( RandomValues.default.getRandomUint64(), {
            "precision": precision || this.INT64_PRECISION,
        } );
    }

    static getRandomInt128 ( { precision } = {} ) {
        return this.getRandomInt( {
            "min": this.MIN_INT128.bigint,
            "max": this.MAX_INT128.bigint,
            "precision": precision || this.INT128_PRECISION,
        } );
    }

    static getRandomUint128 ( { precision } = {} ) {
        return this.getRandomInt( {
            "min": 0n,
            "max": this.MAX_UINT128.bigint,
            "precision": precision || this.INT128_PRECISION,
        } );
    }

    // properties
    get PRECISION () {
        return this.#DECIMAL.constructor.precision;
    }

    get SCALE () {
        return this.#SCALE;
    }

    get ROUNDING_MODE () {
        return this.#DECIMAL.constructor.rounding;
    }

    get MODULO_MODE () {
        return this.#DECIMAL.constructor.modulo;
    }

    get MIN_INTEGER () {
        return this.MAX_INTEGER.negated;
    }

    get MAX_INTEGER () {
        if ( this.#MAX_INTEGER == null ) {
            let value = this.PRECISION - ( this.SCALE || 0 );

            if ( value ) {
                value = "9".repeat( value );
            }

            this.#MAX_INTEGER = new this.constructor( value );
        }

        return this.#MAX_INTEGER;
    }

    get precision () {
        this.#precision ??= this.#DECIMAL.precision( true );

        return this.#precision;
    }

    get scale () {
        this.#scale ??= this.#DECIMAL.decimalPlaces();

        return this.#scale;
    }

    get isNaN () {
        this.#isNaN ??= this.#DECIMAL.isNaN();

        return this.#isNaN;
    }

    get isPositiveInfinity () {
        return this.number === Infinity;
    }

    get isNegativeInfinity () {
        return this.number === -Infinity;
    }

    get isFinite () {
        this.#isFinite ??= this.#DECIMAL.isFinite();

        return this.#isFinite;
    }

    get isInteger () {
        this.#isInteger ??= this.#DECIMAL.isInteger();

        return this.#isInteger;
    }

    get isSafeInteger () {
        return Number.isSafeInteger( this.number );
    }

    get isZero () {
        return this.#DECIMAL.isZero();
    }

    get isPositive () {
        return this.#DECIMAL.isPositive();
    }

    get isNegative () {
        return this.#DECIMAL.isNegative();
    }

    get number () {
        this.#number ??= this.#DECIMAL.toNumber();

        return this.#number;
    }

    get bigint () {
        if ( this.#bigint == null ) {

            // not a number
            if ( !this.isFinite ) {
                this.#bigint = this.number;
            }

            // integer
            else if ( this.isInteger ) {
                this.#bigint = BigInt( this.toString() );
            }

            // float
            else {
                this.#bigint = this.truncated.bigint;
            }
        }

        return this.#bigint;
    }

    get sign () {
        return this.#DECIMAL.sign();
    }

    get abs () {
        this.#abs ??= this.#clone( this.#DECIMAL.abs() );

        return this.#abs;
    }

    get negated () {
        this.#negated ??= this.#clone( this.#DECIMAL.negated() );

        return this.#negated;
    }

    get rounded () {
        if ( this.#rounded == null ) {
            if ( this.isInteger ) {
                this.#rounded = this;
            }
            else {
                this.#rounded = this.round();
            }
        }

        return this.#rounded;
    }

    get truncated () {
        if ( this.#truncated == null ) {
            if ( this.isInteger ) {
                this.#truncated = this;
            }
            else {
                this.#truncated = this.trunc();
            }
        }

        return this.#truncated;
    }

    get floored () {
        if ( this.#floored == null ) {
            if ( this.isInteger ) {
                this.#floored = this;
            }
            else {
                this.#floored = this.floor();
            }
        }

        return this.#floored;
    }

    get ceiled () {
        if ( this.#ceiled == null ) {
            if ( this.isInteger ) {
                this.#ceiled = this;
            }
            else {
                this.#ceiled = this.ceil();
            }
        }

        return this.#ceiled;
    }

    get decimal () {
        this.#decimal ??= this.subtract( this.truncated );

        return this.#decimal;
    }

    get bin () {
        this.#bin ??= this.#DECIMAL.toBinary();

        return this.#bin;
    }

    get hex () {
        this.#hex ??= this.#DECIMAL.toHexadecimal();

        return this.#hex;
    }

    get oct () {
        this.#oct ??= this.#DECIMAL.toOctal();

        return this.#oct;
    }

    // public
    toString ( radix ) {
        radix ||= 10;

        if ( radix === 10 ) {
            this.#string[ radix ] ??= this.#DECIMAL.toString();
        }
        else if ( radix === 16 ) {
            this.#string[ radix ] ??= this.#DECIMAL.toHexadecimal().slice( 2 );
        }
        else if ( radix === 2 ) {
            this.#string[ radix ] ??= this.#DECIMAL.toBinary().slice( 2 );
        }
        else if ( radix === 8 ) {
            this.#string[ radix ] ??= this.#DECIMAL.toOctal().slice( 2 );
        }
        else {
            throw new Error( "Radix is not valid" );
        }

        return this.#string[ radix ];
    }

    valueOf () {
        this.#value ??= this.#DECIMAL.valueOf();

        return this.#value;
    }

    toJSON () {
        return this.valueOf();
    }

    toNumeric ( { precision, scale = this.SCALE, roundingMode, moduloMode } = {} ) {
        return new this.constructor( this.#DECIMAL, {
            precision,
            scale,
            roundingMode,
            moduloMode,
        } );
    }

    toDecimalPlaces ( { scale, roundingMode } = {} ) {
        return this.#clone( this.#DECIMAL.toDecimalPlaces( scale ?? this.SCALE ?? 0, roundingMode ?? this.ROUNDING_MODE ) );
    }

    toExponential ( scale ) {
        return this.#DECIMAL.toExponential( scale );
    }

    compare ( value ) {
        value = prepareDecimalValue( value );

        return this.#DECIMAL.comparedTo( value );
    }

    eq ( value ) {
        value = prepareDecimalValue( value );

        return this.#DECIMAL.equals( value );
    }

    ne ( value ) {
        value = prepareDecimalValue( value );

        return !this.#DECIMAL.equals( value );
    }

    gt ( value ) {
        value = prepareDecimalValue( value );

        return this.#DECIMAL.greaterThan( value );
    }

    gte ( value ) {
        value = prepareDecimalValue( value );

        return this.#DECIMAL.greaterThanOrEqualTo( value );
    }

    lt ( value ) {
        value = prepareDecimalValue( value );

        return this.#DECIMAL.lessThan( value );
    }

    lte ( value ) {
        value = prepareDecimalValue( value );

        return this.#DECIMAL.lessThanOrEqualTo( value );
    }

    round ( scale ) {
        if ( scale ) {
            return this.#clone( this.#DECIMAL.toDecimalPlaces( scale ) );
        }
        else {
            return this.#clone( this.#DECIMAL.round() );
        }
    }

    trunc ( scale ) {
        if ( scale ) {
            return this.#clone( this.#DECIMAL.toDecimalPlaces( scale, ROUNDING_MODE.DOWN ) );
        }
        else {
            return this.#clone( this.#DECIMAL.trunc() );
        }
    }

    floor ( scale ) {
        if ( scale ) {
            return this.#clone( this.#DECIMAL.toDecimalPlaces( scale, ROUNDING_MODE.FLOOR ) );
        }
        else {
            return this.#clone( this.#DECIMAL.floor() );
        }
    }

    ceil ( scale ) {
        if ( scale ) {
            return this.#clone( this.#DECIMAL.toDecimalPlaces( scale, ROUNDING_MODE.CEIL ) );
        }
        else {
            return this.#clone( this.#DECIMAL.ceil() );
        }
    }

    add ( value ) {
        value = prepareDecimalValue( value );

        return this.#clone( this.#DECIMAL.add( value ) );
    }

    subtract ( value ) {
        value = prepareDecimalValue( value );

        return this.#clone( this.#DECIMAL.sub( value ) );
    }

    multiply ( value ) {
        value = prepareDecimalValue( value );

        return this.#clone( this.#DECIMAL.mul( value ) );
    }

    divide ( value ) {
        value = prepareDecimalValue( value );

        return this.#clone( this.#DECIMAL.div( value ) );
    }

    mod ( value, { moduloMode } = {} ) {
        value = prepareDecimalValue( value );

        if ( moduloMode != null && moduloMode !== value.constructor.modulo ) {
            return this.#clone( getDecimal( this.PRECISION, this.ROUNDING_MODE, moduloMode )( this.#DECIMAL ).mod( value ) );
        }
        else {
            return this.#clone( this.#DECIMAL.mod( value ) );
        }
    }

    pow ( exponent ) {
        if ( isNumeric( exponent ) ) {
            exponent = exponent[ DECIMAL_ACCESSOR ];
        }

        return this.#clone( this.#DECIMAL.pow( exponent ) );
    }

    sqrt () {
        this.#sqrt ??= this.#clone( this.#DECIMAL.sqrt() );

        return this.#sqrt;
    }

    cbrt () {
        this.#cbrt ??= this.#clone( this.#DECIMAL.cbrt() );

        return this.#cbrt;
    }

    exp () {
        this.#exp ??= this.#clone( this.#DECIMAL.exp() );

        return this.#exp;
    }

    log () {
        return this.#clone( this.#DECIMAL.naturalLogarithm() );
    }

    logarithm ( base ) {
        return this.#clone( this.#DECIMAL.logarithm( base ) );
    }

    log2 () {
        return this.#clone( this.#DECIMAL.logarithm( 2 ) );
    }

    log10 () {
        return this.#clone( this.#DECIMAL.logarithm( 10 ) );
    }

    // private
    get [ DECIMAL_ACCESSOR ] () {
        return this.#DECIMAL;
    }

    #clone ( value ) {
        return new this.constructor( value, {
            "scale": this.#SCALE,
        } );
    }

    #toPrecision ( decimal, precision, scale, roundingMode, moduloMode ) {

        // check precision
        if ( precision == null ) {
            precision = decimal.constructor.precision;
        }
        else if ( !Number.isInteger( precision ) || precision <= 0 ) {
            throw TypeError( "Precision must be number > 0" );
        }

        // check rounding mode
        if ( roundingMode == null ) {
            roundingMode = decimal.constructor.rounding;
        }
        else if ( !ROUNDING_MODE_VALUES.has( roundingMode ) ) {
            throw TypeError( "Rounding mode value is not valid" );
        }

        // check modulo mode
        if ( moduloMode == null ) {
            moduloMode = decimal.constructor.modulo;
        }
        else if ( !MODULO_MODE_VALUES.has( moduloMode ) ) {
            throw TypeError( "Modulo mode value is not valid" );
        }

        // update decimal
        if ( precision !== decimal.constructor.precision || roundingMode !== decimal.constructor.rounding || moduloMode !== decimal.constructor.modulo ) {
            decimal = getDecimal( precision, roundingMode, moduloMode )( decimal );
        }

        var maxIntegerPlaces;

        // check scale
        if ( scale == null ) {
            maxIntegerPlaces = precision;
        }
        else if ( scale === 0 ) {
            maxIntegerPlaces = precision;
        }
        else if ( Number.isInteger( scale ) && scale > 0 ) {
            if ( scale > precision ) {
                throw TypeError( "Scale must be integer <= precision" );
            }

            maxIntegerPlaces = precision - scale;
        }
        else {
            throw TypeError( "Scale must be positive integer" );
        }

        const realPrecision = decimal.precision( true ),
            realScale = decimal.decimalPlaces(),
            realIntegerPlaces = realPrecision - realScale;

        // check integer places
        if ( realIntegerPlaces > maxIntegerPlaces ) {
            throw RangeError( "Numeric precision is out of range" );
        }

        var decimalPlaces;

        // check precision
        if ( realPrecision > precision ) {
            decimalPlaces = precision - realIntegerPlaces;

            if ( decimalPlaces < 0 ) {
                throw RangeError( "Numeric precision is out of range" );
            }
            else if ( scale != null && scale < decimalPlaces ) {
                decimalPlaces = scale;
            }
        }

        // check scale
        else if ( scale != null && scale < realScale ) {
            decimalPlaces = scale;
        }

        // round to decimal places
        if ( decimalPlaces != null ) {
            decimal = decimal.toDecimalPlaces( decimalPlaces );

            // check integer places
            if ( decimal.precision( true ) - decimal.decimalPlaces() > maxIntegerPlaces ) {
                throw RangeError( "Numeric precision is out of range" );
            }
        }

        return decimal;
    }
}
