import Alphabet from "#lib/crypto/passwords/alphabet";
import Interval from "#lib/interval";
import utf8Ranges from "./passwords/ranges.js";

const DEFAULT_ALPHABET = "alnum",
    BRUTE_FORCE_YEARS = 100_000,
    BRUTE_FORCE_RATES = {
        "online": 1000,
        "offline": 1_000_000_000,
    },
    ALPHABETS = {};

var STRONG_BIT_STRENGTH = 0;

{
    let guesses = BigInt( 60 * 60 * 24 * 365 * BRUTE_FORCE_YEARS ) * BigInt( Math.max( ...Object.values( BRUTE_FORCE_RATES ) ) );

    while ( guesses > 0n ) {
        STRONG_BIT_STRENGTH++;

        guesses >>= 1n;
    }
}

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
    registerAlphabet ( name, ranges, { tags } = {} ) {
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
            } ),
            { tags }
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

    for ( const { range, category, tags } of utf8Ranges ) {
        alphabets[ category ] ??= {
            "ranges": [],
            "tags": [],
        };

        alphabets[ category ].ranges.push( range );

        if ( tags ) {
            alphabets[ category ].tags.push( ...tags );
        }
    }

    for ( const alphabet in alphabets ) {
        passwords.registerAlphabet( alphabet, alphabets[ alphabet ].ranges, {
            "tags": alphabets[ alphabet ].tags,
        } );
    }
}

passwords.registerAlphabet( "letters", [ "letters-upper-case", "letters-lower-case" ], { "tags": [ "ascii" ] } );
passwords.registerAlphabet( "alnum", [ "letters", "numbers" ], { "tags": [ "ascii" ] } );
passwords.registerAlphabet( "ascii", [ "alnum", "symbols" ], { "tags": [ "ascii" ] } );
passwords.registerAlphabet( "latin1", [ "ascii", "Latin-1 Supplement" ] );
passwords.registerAlphabet( "bytes", [ "control", "latin1" ] );
passwords.registerAlphabet(
    "utf8",
    passwords.alphabets.filter( alphabet => alphabet.tags.has( "utf8" ) )
);
