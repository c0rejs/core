import "#lib/result";
import crypto from "node:crypto";
import { randomBytes } from "#lib/crypto";
import { fromPhc, toPhc } from "#lib/phc";

const DEFAULT_PRESET = "owasp",
    DEFAULT_SALT_LENGTH = 16,
    DEFAULT_HASH_LENGTH = 16,
    ARGON2_VERSIONS = new Set( [ 16, 19 ] ),
    ALGORITHMS = {
        "argon2i": {
            "algorithm": "argon2",
            "version": 19,
            "memoryCost": 1024 * 19, // 19 MiB
            "timeCost": 2,
            "parallelism": 1,
        },
        "argon2d": {
            "algorithm": "argon2",
            "version": 19,
            "memoryCost": 1024 * 19, // 19 MiB
            "timeCost": 2,
            "parallelism": 1,
        },
        "argon2id": {
            "algorithm": "argon2",
            "version": 19,
            "memoryCost": 1024 * 19, // 19 MiB
            "timeCost": 2,
            "parallelism": 1,
        },
        "scrypt": {
            "algorithm": "scrypt",
            "cost": 2 ** 17, // 128 MiB
            "blockSize": 8, // 1024 bytes
            "parallelism": 1,
        },
        "pbkdf2-sha1": {
            "algorithm": "pbkdf2",
            "digest": "SHA1",
            "iterations": 1_300_000,
        },
        "pbkdf2-sha256": {
            "algorithm": "pbkdf2",
            "digest": "SHA256",
            "iterations": 600_000,
        },
        "pbkdf2-sha512": {
            "algorithm": "pbkdf2",
            "digest": "SHA3-512",
            "iterations": 210_000,
        },
    },
    PRESETS = {

        // owasp
        // DOCS: https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html
        "owasp": "owasp:v2026.1.1",
        "owasp:v2026.1.1": "argon2id:v2026.1.1",

        // argon2
        "argon2": "argon2:v2026.1.1",
        "argon2:v2026.1.1": "argon2id:v2026.1.1",

        "argon2i": "argon2i:v2026.1.1",
        "argon2i:v2026.1.1": {
            "id": "argon2i",
            "version": 19,
            "memoryCost": 1024 * 19, // 19 MiB
            "timeCost": 2,
            "parallelism": 1,
        },

        "argon2d": "argon2d:v2026.1.1",
        "argon2d:v2026.1.1": {
            "id": "argon2d",
            "version": 19,
            "memoryCost": 1024 * 19, // 19 MiB
            "timeCost": 2,
            "parallelism": 1,
        },

        // DOCS: https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html#argon2id
        "argon2id": "argon2id:v2026.1.1",
        "argon2id:v2026.1.1": {
            "id": "argon2id",
            "version": 19,
            "memoryCost": 1024 * 19, // 19 MiB
            "timeCost": 2,
            "parallelism": 1,
        },

        // DOCS: rfc-9106 recommended settings in 2025
        // https://datatracker.ietf.org/doc/html/rfc9106#name-recommendations
        "rfc-9106-high": {
            "id": "argon2id",
            "version": 19,
            "memoryCost": 1024 * 1024 * 2, // 2 GiB
            "timeCost": 1,
            "parallelism": 1,
        },
        "rfc-9106-low": {
            "id": "argon2id",
            "version": 19,
            "memoryCost": 1024 * 64, // 64 MiB
            "timeCost": 3,
            "parallelism": 1,
        },

        // scrypt
        // DOCS: https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html#scrypt
        "scrypt": "scrypt:v2026.1.1",
        "scrypt:v2026.1.1": {
            "id": "scrypt",
            "cost": 2 ** 17, // 128 MiB
            "blockSize": 8, // 1024 bytes
            "parallelism": 1,
        },

        // pbkdf2
        // DOCS: https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html#pbkdf2
        "pbkdf2": "pbkdf2:v2026.1.1",
        "pbkdf2:v2026.1.1": "pbkdf2-sha256:v2026.1.1",

        "pbkdf2-sha1": "pbkdf2-sha1:v2026.1.1",
        "pbkdf2-sha1:v2026.1.1": {
            "id": "pbkdf2-sha1",
            "iterations": 1_300_000,
        },

        "pbkdf2-sha256": "pbkdf2-sha256:v2026.1.1",
        "pbkdf2-sha256:v2026.1.1": {
            "id": "pbkdf2-sha256",
            "iterations": 600_000,
        },

        "pbkdf2-sha512": "pbkdf2-sha512:v2026.1.1",
        "pbkdf2-sha512:v2026.1.1": {
            "id": "pbkdf2-sha512",
            "iterations": 210_000,
        },

        // openssl
        "openssl": "openssl:v2026.1.1",
        "openssl:v2026.1.1": {
            "id": "pbkdf2-sha256",
            "iterations": 10_000,
            "saltLength": 8,
        },
    },
    PHC_PARAMS = {
        "argon2": {
            "memoryCost": "m",
            "timeCost": "t",
            "parallelism": "p",
        },
        "scrypt": {
            "cost": "ln",
            "blockSize": "r",
            "parallelism": "p",
        },
        "pbkdf2": {
            "iterations": "i",
        },
    };

for ( const id in ALGORITHMS ) {
    ALGORITHMS[ id ] = {
        id,
        ...ALGORITHMS[ id ],
    };

    ALGORITHMS[ id ].saltLength ||= DEFAULT_SALT_LENGTH;
    ALGORITHMS[ id ].hashLength ||= DEFAULT_HASH_LENGTH;
}

for ( const preset in PRESETS ) {
    if ( typeof PRESETS[ preset ] !== "object" ) continue;

    PRESETS[ preset ] = {
        ...ALGORITHMS[ PRESETS[ preset ].id ],
        ...PRESETS[ preset ],
    };
}

for ( const preset in PRESETS ) {
    if ( !preset.includes( ":" ) ) continue;

    if ( typeof PRESETS[ preset ] !== "string" ) continue;

    PRESETS[ preset ] = PRESETS[ PRESETS[ preset ] ];

    if ( typeof PRESETS[ preset ] !== "object" ) throw new Error( `Preset "${ preset }" is not valid` );
}

for ( const preset in PRESETS ) {
    if ( typeof PRESETS[ preset ] !== "string" ) continue;

    PRESETS[ preset ] = PRESETS[ PRESETS[ preset ] ];

    if ( typeof PRESETS[ preset ] !== "object" ) throw new Error( `Preset "${ preset }" is not valid` );
}

export default class PasswordHash {
    #preset;
    #options;

    constructor ( { "preset": presetName, version, memoryCost, timeCost, parallelism, cost, blockSize, maxMemory, iterations, saltLength, hashLength } = {} ) {
        presetName ||= DEFAULT_PRESET;

        if ( !PRESETS[ presetName ] ) throw new Error( "Preset name is not valid" );

        this.#preset = presetName;

        this.#options = {
            ...PRESETS[ this.#preset ],
        };

        // argon2
        if ( this.#options.algorithm === "argon2" ) {
            if ( saltLength ) this.#options.saltLength = saltLength;
            if ( hashLength ) this.#options.hashLength = hashLength;

            if ( version ) this.#options.version = version;
            if ( !ARGON2_VERSIONS.has( this.#options.version ) ) throw "Argon2 version is not valid";

            if ( memoryCost ) this.#options.memoryCost = memoryCost;
            if ( this.#options.memoryCost < 1 || this.#options.memoryCost > 2 ** 32 - 1 ) throw "Argon2 memory cost value is not valid";

            if ( timeCost ) this.#options.timeCost = timeCost;
            if ( this.#options.timeCost < 1 || this.#options.timeCost > 2 ** 32 - 1 ) throw "Argon2 time cost value is not valid";

            if ( parallelism ) this.#options.parallelism = parallelism;
            if ( this.#options.parallelism < 1 || this.#options.parallelism > 255 ) throw "Argon2 parallelism value is not valid";
        }

        // scrypt
        else if ( this.#options.algorithm === "scrypt" ) {
            if ( saltLength ) this.#options.saltLength = saltLength;
            if ( hashLength ) this.#options.hashLength = hashLength;

            if ( cost ) this.#options.cost = cost;
            if ( blockSize ) this.#options.blockSize = blockSize;
            if ( parallelism ) this.#options.parallelism = parallelism;

            this.#options.maxMemory = maxMemory || this.constructor.calculateMaxMemory( this.#options );
        }

        // pbkdf2
        else if ( this.#options.algorithm === "pbkdf2" ) {
            if ( saltLength ) this.#options.saltLength = saltLength;
            if ( hashLength ) this.#options.hashLength = hashLength;

            if ( iterations ) this.#options.iterations = iterations;
        }

        if ( this.#options.saltLength < 8 || this.#options.saltLength > 64 ) throw "Salt length value is not valid";

        if ( this.#options.hashLength < 12 || this.#options.hashLength > 64 ) throw "Hash length value is not valid";
    }

    // static
    static get presets () {
        return PRESETS;
    }

    static get defaultPreset () {
        return DEFAULT_PRESET;
    }

    static calculateMaxMemory ( { cost, blockSize, parallelism } ) {

        // 128 * p * r + 128 * ( 2 + N ) * r
        return 128 * parallelism * blockSize + 128 * ( 2 + cost ) * blockSize;
    }

    // properties
    get preset () {
        return this.#preset;
    }

    get algorithm () {
        return this.#options.algorithm;
    }

    get id () {
        return this.#options.id;
    }

    get version () {
        return this.#options.version;
    }

    get memoryCost () {
        return this.#options.memoryCost;
    }

    get timeCost () {
        return this.#options.timeCost;
    }

    get parallelism () {
        return this.#options.parallelism;
    }

    get cost () {
        return this.#options.cost;
    }

    get blockSize () {
        return this.#options.blockSize;
    }

    get maxMemory () {
        return this.#options.maxMemory;
    }

    get digest () {
        return this.#options.digest;
    }

    get iterations () {
        return this.#options.iterations;
    }

    get saltLength () {
        return this.#options.saltLength;
    }

    get hashLength () {
        return this.#options.hashLength;
    }

    // public
    async createPasswordHash ( password, { phc = true, salt, hashLength, secret, data } = {} ) {

        // generate salt
        if ( !salt ) {
            salt = await randomBytes( this.saltLength );
        }

        data ||= undefined;

        // validate data
        if ( data && ( typeof data !== "string" || /[$,]/.test( data ) ) ) {
            return result( [ 400, "Data parameter is not valid" ] );
        }

        return this.#createHash( password, {
            ...this.#options,
            phc,
            salt,
            "hashLength": hashLength || this.#options.hashLength,
            secret,
            data,
        } );
    }

    async verifyPasswordHash ( digest, password, { update, phc = true, secret, data } = {} ) {
        try {
            if ( !Buffer.isBuffer( password ) ) password = Buffer.from( password );

            const parsed = fromPhc( digest );

            const algorithm = ALGORITHMS[ parsed.id ];
            if ( !algorithm ) return result( [ 500, "Algorithm is not supported" ] );

            const defaults = parsed.id === this.id
                ? this.#options
                : algorithm;

            var match = false,
                requireUpdate = false,
                compareHash = true;

            const options = {
                ...defaults,
                "phc": false,
                "salt": parsed.salt,
                "hashLength": parsed.hash.length,
                secret,
            };

            if ( parsed.id !== this.id ) {
                requireUpdate = true;
            }

            if ( options.hashLength !== defaults.hashLength ) {
                requireUpdate = true;
            }

            if ( options.salt.length !== defaults.saltLength ) {
                requireUpdate = true;
            }

            // compare params
            for ( const [ propertyName, phcName ] of Object.entries( PHC_PARAMS[ options.algorithm ] ) ) {
                if ( !parsed.params[ phcName ] ) {
                    requireUpdate = true;
                }
                else if ( parsed.params[ phcName ] !== options[ propertyName ] ) {
                    requireUpdate = true;

                    options[ propertyName ] = parsed.params[ phcName ];
                }
            }

            // argon2
            if ( options.algorithm === "argon2" ) {

                // version
                if ( !parsed.version ) {
                    requireUpdate = true;
                }
                else if ( !ARGON2_VERSIONS.has( parsed.version ) ) {
                    requireUpdate = true;
                    compareHash = false;
                }
                else if ( parsed.version !== options.version ) {
                    requireUpdate = true;

                    options.version = parsed.version;
                }

                // data is not defined
                if ( data === undefined ) {

                    // use old data
                    data = options.data = parsed.params.data;
                }

                // data is defined
                else {
                    data ||= undefined;

                    // validate data
                    if ( data && ( typeof data !== "string" || /[$,]/.test( data ) ) ) {
                        return result( [ 400, "Data parameter is not valid" ] );
                    }

                    // data changed
                    if ( parsed.params.data !== data ) {
                        requireUpdate = true;
                        compareHash = false;
                    }

                    // data not changed
                    else {
                        options.data = data;
                    }
                }
            }

            // scrypt
            else if ( options.algorithm === "scrypt" ) {
                options.maxMemory = this.maxMemory || this.constructor.calculateMaxMemory( options );
            }

            // compare hash
            if ( compareHash ) {
                const res = await this.#createHash( password, options );
                if ( !res.ok ) return res;

                match = crypto.timingSafeEqual( res.data.hash, parsed.hash );
            }

            var updatedHash;

            if ( update && requireUpdate ) {
                const res = await this.createPasswordHash( password, { phc, secret, data } );
                if ( !res.ok ) return res;

                updatedHash = res.data;
            }
            else {
                updatedHash = {};
            }

            if ( match ) {
                return result( 200, {
                    requireUpdate,
                    ...updatedHash,
                } );
            }
            else {
                return result( [ 400, "Password is not valid" ], {
                    requireUpdate,
                    ...updatedHash,
                } );
            }
        }
        catch ( e ) {
            return result.catch( e );
        }
    }

    // private
    async #createHash ( password, options ) {
        try {
            if ( !Buffer.isBuffer( password ) ) password = Buffer.from( password );

            let hash;

            // argon2
            if ( options.algorithm === "argon2" ) {
                hash = await this.#createArgon2Hash( password, options );
            }

            // scrypt
            else if ( options.algorithm === "scrypt" ) {
                hash = await this.#createScryptHash( password, options );
            }

            // pbkdf2
            else if ( options.algorithm === "pbkdf2" ) {
                hash = await this.#createPbkdf2Hash( password, options );
            }

            return result( 200, hash );
        }
        catch ( e ) {
            return result.catch( e );
        }
    }

    async #createArgon2Hash ( password, { id, phc, salt, hashLength, version, memoryCost, timeCost, parallelism, secret, data } ) {
        const hash = await new Promise( ( resolve, reject ) => {
            crypto.argon2(
                id,
                {
                    "message": password,
                    "nonce": salt,
                    parallelism,
                    "tagLength": hashLength,
                    "memory": memoryCost,
                    "passes": timeCost,
                    secret,
                    "associatedData": data,
                },
                ( e, hash ) => {
                    if ( e ) {
                        reject( e );
                    }
                    else {
                        resolve( hash );
                    }
                }
            );
        } );

        if ( phc ) {
            return {
                salt,
                hash,
                "phc": toPhc( {
                    id,
                    version,
                    "params": {
                        [ PHC_PARAMS.argon2.memoryCost ]: memoryCost,
                        [ PHC_PARAMS.argon2.timeCost ]: timeCost,
                        [ PHC_PARAMS.argon2.parallelism ]: parallelism,
                        data,
                    },
                    salt,
                    hash,
                } ),
            };
        }
        else {
            return {
                salt,
                hash,
            };
        }
    }

    async #createScryptHash ( password, { id, phc, salt, hashLength, cost, blockSize, parallelism, maxMemory } ) {
        const hash = await new Promise( ( resolve, reject ) => {
            crypto.scrypt(
                password,
                salt,
                hashLength,
                {
                    cost,
                    blockSize,
                    "parallelization": parallelism,
                    "maxmem": maxMemory,
                },
                ( e, hash ) => {
                    if ( e ) {
                        reject( e );
                    }
                    else {
                        resolve( hash );
                    }
                }
            );
        } );

        if ( phc ) {
            return {
                salt,
                hash,
                "phc": toPhc( {
                    id,
                    "version": undefined,
                    "params": {
                        [ PHC_PARAMS.scrypt.cost ]: cost,
                        [ PHC_PARAMS.scrypt.blockSize ]: blockSize,
                        [ PHC_PARAMS.scrypt.parallelism ]: parallelism,
                    },
                    salt,
                    hash,
                } ),
            };
        }
        else {
            return {
                salt,
                hash,
            };
        }
    }

    async #createPbkdf2Hash ( password, { id, phc, salt, hashLength, digest, iterations } ) {
        const hash = await new Promise( ( resolve, reject ) => {
            crypto.pbkdf2( password, salt, iterations, hashLength, digest, ( e, hash ) => {
                if ( e ) {
                    reject( e );
                }
                else {
                    resolve( hash );
                }
            } );
        } );

        if ( phc ) {
            return {
                salt,
                hash,
                "phc": toPhc( {
                    id,
                    "version": undefined,
                    "params": {
                        [ PHC_PARAMS.pbkdf2.iterations ]: iterations,
                    },
                    salt,
                    hash,
                } ),
            };
        }
        else {
            return {
                salt,
                hash,
            };
        }
    }
}
