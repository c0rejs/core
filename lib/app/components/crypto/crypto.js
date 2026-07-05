import PasswordHash from "#lib/crypto/password-hash";
import LocalCryptoKeyring from "./crypto/keyring/local.js";
import RemoteCryptoKeyring from "./crypto/keyring/remote.js";

export default class Env {
    #app;
    #config;
    #keyring;
    #passwordHash;

    constructor ( app, config ) {
        this.#app = app;
        this.#config = config;
    }

    // properties
    get app () {
        return this.#app;
    }

    get algorithm () {
        return this.#config.algorithm;
    }

    get passwordHash () {
        return this.#passwordHash;
    }

    // public
    async init () {

        // create keyring
        if ( this.#config.useLocalKeyring || !this.app.dbh ) {
            this.#keyring = new LocalCryptoKeyring( this, this.#config.key );
        }
        else {
            this.#keyring = new RemoteCryptoKeyring( this, this.#config.key );
        }

        var res;

        // init keyring
        res = await this.#keyring.init();
        if ( !res.ok ) return res;

        this.#passwordHash = new PasswordHash( {
            ...this.#config.passwordHash,
            "secret": this.#resolvePasswordHashSecret.bind( this ),
        } );

        return result( 200 );
    }

    async encrypt ( data, { inputEncoding, outputEncoding } = {} ) {
        return this.#keyring.encrypt( data, { inputEncoding, outputEncoding } );
    }

    async decrypt ( data, { inputEncoding, outputEncoding } = {} ) {
        return this.#keyring.decrypt( data, { inputEncoding, outputEncoding } );
    }

    async revokeKey () {
        return this.#keyring.revokeKey();
    }

    async revokeMasterKey ( masterKey ) {
        return this.#keyring.revokeMasterKey( masterKey );
    }

    // private
    async #resolvePasswordHashSecret ( { id, verify } = {} ) {
        if ( verify && !id ) {
            return result( 200, {
                "requireUpdate": true,
            } );
        }
        else {
            const key = await this.#keyring.getKey( id );

            if ( key ) {
                return result( 200, {
                    "id": key.id,
                    "key": key.key.export( {
                        "format": "buffer",
                    } ),
                    "requireUpdate": key.revoked
                        ? true
                        : false,
                } );
            }
            else {
                return result( [ 500, "Unable to get secret key" ] );
            }
        }
    }
}
