import Alphabet from "#lib/crypto/passwords/alphabet";
import Interval from "#lib/interval";
import utf8Ranges from "./passwords/ranges.js";

// NOTE:
// https://therootcompany.com/blog/how-many-bits-of-entropy-per-character/
// https://en.wikipedia.org/wiki/Password_strength#Entropy_as_a_measure_of_password_strength

// 19 bits - common for OTP
// 29 bits - minimum recommendation for online systems
// 96 bits - minimum recommendation for offline systems
// 128 bits - common for API keys
// 256 bits - common for overkill
// 4096 bits - common for prime numbers (sparse keyspace)

const STRONG_BIT_STRENGTH = 70,
    DEFAULT_ALPHABET = "alnum",
    BRUTE_FORCE_RATES = {
        "online": 1000,
        "offline": 1_000_000_000,
    },
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
            "length": chars.length,
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
            "length": password.length,
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
        const category = utf8Ranges.findCodePointCategory( codePoint );

        return ALPHABETS[ category ];
    }

    estimateBruteForce ( bitStrength ) {
        const data = { ...BRUTE_FORCE_RATES },
            iterations = 2n ** BigInt( Math.ceil( bitStrength ) );

        for ( const id in data ) {
            const seconds = iterations / BigInt( data[ id ] );

            data[ id ] = {
                "rate": data[ id ],
                "interval": new Interval( seconds, "seconds" ),
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

    for ( const { range, category } of utf8Ranges ) {
        alphabets[ category ] ??= [];

        alphabets[ category ].push( range );
    }

    for ( const alphabet in alphabets ) {
        passwords.registerAlphabet( alphabet, alphabets[ alphabet ] );
    }
}

passwords.registerAlphabet( "letters", [ "letters-upper-case", "letters-lower-case" ] );
passwords.registerAlphabet( "alnum", [ "letters", "numbers" ] );
passwords.registerAlphabet( "ascii", [ "alnum", "symbols" ] );
passwords.registerAlphabet( "latin1", [ "ascii", "Latin-1 Supplement" ] );
passwords.registerAlphabet( "bytes", [ "control", "latin1" ] );
