import Alphabet from "#lib/crypto/passwords/alphabet";
import Interval from "#lib/interval";

// NOTE:
// https://therootcompany.com/blog/how-many-bits-of-entropy-per-character/
// https://en.wikipedia.org/wiki/Password_strength#Entropy_as_a_measure_of_password_strength
// https://github.com/radiovisual/unicode-range-json/blob/master/unicode-ranges.json

// 19 bits - common for OTP
// 29 bits - minimum recommendation for online systems
// 96 bits - minimum recommendation for offline systems
// 128 bits - common for API keys
// 256 bits - common for overkill
// 4096 bits - common for prime numbers (sparse keyspace)

const STRONG_BIT_STRENGTH = 96,
    DEFAULT_ALPHABET = "alnum",
    BRUTE_FORCE_RATES = {
        "online": 100,
        "online_throttled": 10,
        "offline": 1_000_000_000_000,
        "offline_hashed": 10_000,
    },
    RANGES = [
        [ 0x00, 0x1F, "control" ],
        [ 0x20, 0x20, "control" ], // space
        [ 0x21, 0x2F, "symbols" ], // !"#$%&'()*+,-./
        [ 0x30, 0x39, "numbers" ], // 0-9
        [ 0x3A, 0x40, "symbols" ], // :;<=>?@
        [ 0x41, 0x5A, "letters-upper-case" ], // A-Z
        [ 0x5B, 0x60, "symbols" ], // [\]^_`
        [ 0x61, 0x7A, "letters-lower-case" ], // a-z
        [ 0x7B, 0x7E, "symbols" ], // {|}~
        [ 0x7F, 0x7F, "control" ], // DEL
        [ 0x80, 0x9F, "control" ], // utf8 reserved
        [ 0xA0, 0xFF, "latin1-supplement" ], // latin1 supplement
        [ 0x0100, 0xD7FF, "utf8" ],
        [ 0xD800, 0xDFFF, "utf16" ], // utf16 surrogates
        [ 0xE000, 0x10FFFF, "utf8" ],
    ],
    ALPHABETS = {};

class Passwords {

    // properties
    get alphabets () {
        return Object.values( ALPHABETS );
    }

    get defaultAlphabet () {
        return DEFAULT_ALPHABET;
    }

    get strongBitStrength () {
        return STRONG_BIT_STRENGTH;
    }

    // public
    registerAlphabet ( name, ranges ) {
        if ( ALPHABETS[ name ] ) throw new Error( "Alphabet already registered" );

        ALPHABETS[ name ] = new Alphabet(
            name,
            ranges.map( range => {
                if ( typeof range === "string" ) {
                    return ALPHABETS[ range ];
                }
                else {
                    return range;
                }
            } )
        );
    }

    getAlphabet ( name ) {
        if ( !name ) {
            return;
        }
        else if ( name instanceof Alphabet ) {
            return name;
        }
        else {
            return ALPHABETS[ name ];
        }
    }

    generateRandomPassword ( { alphabet = DEFAULT_ALPHABET, bitStrength = STRONG_BIT_STRENGTH, length } = {} ) {
        alphabet = this.getAlphabet( alphabet );

        const usedAlphabets = new Set(),
            chars = [];

        var usedAlphabetsSize = 0,
            usedCharBitStrength = 0,
            passwordBitStrength = 0;

        while ( length
            ? chars.length < length
            : passwordBitStrength < bitStrength ) {
            const char = alphabet.generateRandomChar();

            chars.push( char );

            const charAlphabet = this.findCodePointAlphabet( char );

            // add alphabet
            if ( !usedAlphabets.has( charAlphabet ) ) {
                usedAlphabets.add( charAlphabet );

                usedAlphabetsSize += charAlphabet.size;

                usedCharBitStrength = Math.log2( usedAlphabetsSize );
            }

            passwordBitStrength = usedCharBitStrength * chars.length;
        }

        return {
            "password": chars.join( "" ),
            "bitStrength": passwordBitStrength,
            "strong": passwordBitStrength >= STRONG_BIT_STRENGTH,
            alphabet,
            usedAlphabetsSize,
            usedCharBitStrength,
            "usedAlphabets": [ ...usedAlphabets ],
            "bruteForceEstimations": this.estimateBruteForce( passwordBitStrength ),
        };
    }

    checkPassword ( password, { alphabet } = {} ) {
        alphabet = this.getAlphabet( alphabet );

        const usedAlphabets = new Set(),
            invalidChars = new Set();

        var usedAlphabetsSize = 0;

        for ( const char of password ) {
            if ( alphabet ) {
                if ( !alphabet.hasCodePoint( char ) ) {
                    invalidChars.add( char );
                }
            }

            const charAlphabet = this.findCodePointAlphabet( char );

            // add alphabet
            if ( !usedAlphabets.has( charAlphabet ) ) {
                usedAlphabets.add( charAlphabet );

                usedAlphabetsSize += charAlphabet.size;
            }
        }

        const usedCharBitStrength = Math.log2( usedAlphabetsSize ),
            passwordBitStrength = usedCharBitStrength * password.length;

        return {
            password,
            "bitStrength": passwordBitStrength,
            "strong": passwordBitStrength >= STRONG_BIT_STRENGTH,
            alphabet,
            "invalidChars": [ ...invalidChars ].sort(),
            usedAlphabetsSize,
            usedCharBitStrength,
            "usedAlphabets": [ ...usedAlphabets ],
            "bruteForceEstimations": this.estimateBruteForce( passwordBitStrength ),
        };
    }

    findCodePointAlphabet ( codePoint ) {
        if ( typeof codePoint === "string" ) {
            codePoint = codePoint.codePointAt( 0 );
        }

        for ( const range of RANGES ) {
            if ( codePoint <= range[ 1 ] ) {
                return ALPHABETS[ range[ 2 ] ];
            }
        }
    }

    estimateBruteForce ( bitStrength ) {
        const data = { ...BRUTE_FORCE_RATES },
            iterations = 2n ** BigInt( Math.ceil( bitStrength ) );

        for ( const id in data ) {
            const seconds = iterations / BigInt( data[ id ] );

            data[ id ] = {
                "rate": data[ id ],
                "duration": new Interval( seconds, "seconds" ),
            };
        }

        return data;
    }
}

const passwords = new Passwords();

export default passwords;

// register alphabets
{
    const alphabets = {};

    for ( const [ start, end, name ] of RANGES ) {
        alphabets[ name ] ??= [];

        alphabets[ name ].push( { start, end, "inclusive": true } );
    }

    for ( const alphabet in alphabets ) {
        passwords.registerAlphabet( alphabet, alphabets[ alphabet ] );
    }
}

passwords.registerAlphabet( "letters", [ "letters-upper-case", "letters-lower-case" ] );
passwords.registerAlphabet( "alnum", [ "letters", "numbers" ] );
passwords.registerAlphabet( "ascii", [ "alnum", "symbols" ] );
passwords.registerAlphabet( "latin1", [ "ascii", "latin1-supplement" ] );
passwords.registerAlphabet( "bytes", [ "control", "latin1" ] );
