import Alphabet from "#lib/crypto/passwords/alphabet";
import Interval from "#lib/interval";
import utf8Ranges from "./passwords/ranges.js";

const DEFAULT_ALPHABET = "alnum",
    DEFAULT_CRACK_YEARS_THRESHOLD = 100_000,
    DEFAULT_CRACK_RATES = {
        "online": 1000,
        "offline": 1_000_000_000,
    },
    ALPHABETS = {};

export default class Passwords {
    #defaultAlphabet;
    #crackYearsThreshold;
    #crackRates;
    #bitStrengthThreshold = 0;

    constructor ( { defaultAlphabet = DEFAULT_ALPHABET, crackYearsThreshold = DEFAULT_CRACK_YEARS_THRESHOLD, crackRates } = {} ) {
        this.#defaultAlphabet = defaultAlphabet;
        this.#crackYearsThreshold = crackYearsThreshold;
        this.#crackRates = crackRates || DEFAULT_CRACK_RATES;

        let guesses = BigInt( 60 * 60 * 24 * 365 * this.#crackYearsThreshold ) * BigInt( Math.max( ...Object.values( this.#crackRates ) ) );

        while ( guesses > 0n ) {
            this.#bitStrengthThreshold++;

            guesses >>= 1n;
        }
    }

    // static
    static get default () {
        return DEFAULT_PASSWORDS;
    }

    static get alphabets () {
        return Object.values( ALPHABETS );
    }

    static getAlphabet ( name ) {
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

    static addAlphabet ( name, ranges, { tags } = {} ) {
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

    // properties
    get defaultAlphabet () {
        return this.#defaultAlphabet;
    }

    get crackYearsThreshold () {
        return this.#crackYearsThreshold;
    }

    get bitStrengthThreshold () {
        return this.#bitStrengthThreshold;
    }

    // public
    getAlphabet ( name ) {
        return this.constructor.getAlphabet( name );
    }

    generateRandomPassword ( { alphabet, bitStrength, length } = {} ) {
        alphabet = this.getAlphabet( alphabet || this.defaultAlphabet );

        bitStrength ??= this.#bitStrengthThreshold;

        const usedAlphabets = new Set(),
            chars = [];

        var usedAlphabetsSize = 0,
            usedCharBitStrength = 0,
            passwordBitStrength = 0;

        while ( length
            ? chars.length < length
            : passwordBitStrength < bitStrength ) {
            const char = alphabet.getRandomChar();

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
            "isStrong": passwordBitStrength >= this.#bitStrengthThreshold,
            alphabet,
            usedAlphabetsSize,
            usedCharBitStrength,
            "usedAlphabets": [ ...usedAlphabets ],
            "crackTime": this.estimateCrackTime( passwordBitStrength ),
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
            "isStrong": passwordBitStrength >= this.#bitStrengthThreshold,
            alphabet,
            "invalidChars": [ ...invalidChars ].sort(),
            usedAlphabetsSize,
            usedCharBitStrength,
            "usedAlphabets": [ ...usedAlphabets ],
            "crackTime": this.estimateCrackTime( passwordBitStrength ),
        };
    }

    findCodePointAlphabet ( codePoint ) {
        const category = utf8Ranges.findCodePointCategory( codePoint );

        return ALPHABETS[ category ];
    }

    estimateCrackTime ( bitStrength ) {
        const data = { ...this.#crackRates },
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

const DEFAULT_PASSWORDS = new Passwords();

// add alphabets
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
        Passwords.addAlphabet( alphabet, alphabets[ alphabet ].ranges, {
            "tags": alphabets[ alphabet ].tags,
        } );
    }
}

Passwords.addAlphabet( "letters", [ "letters-upper-case", "letters-lower-case" ], { "tags": [ "ascii" ] } );
Passwords.addAlphabet( "alnum", [ "letters", "numbers" ], { "tags": [ "ascii" ] } );
Passwords.addAlphabet( "ascii", [ "alnum", "symbols" ], { "tags": [ "ascii" ] } );
Passwords.addAlphabet( "latin1", [ "ascii", "Latin-1 Supplement" ] );
Passwords.addAlphabet( "bytes", [ "control", "latin1" ] );
Passwords.addAlphabet(
    "utf8",
    Passwords.alphabets.filter( alphabet => alphabet.tags.has( "utf8" ) )
);
