import fs from "node:fs";
import path from "node:path";
import Mutex from "#lib/threads/mutex";
import CryptoKeyring from "../keyring.js";

export default class LocalCryptoKeyring extends CryptoKeyring {
    #keyringPath;
    #keyring;
    #mutexes = new Mutex.Set();

    constructor ( ...args ) {
        super( ...args );

        this.#keyringPath = this.app.env.dataDir + "/crypto/keyring.json";
    }

    // protected
    async _init () {
        return result( 200 );
    }

    _getSharedMutex ( id ) {
        id = "/crypto/" + id;

        return this.#mutexes.get( id );
    }

    async _checkMasterKeyHash ( masterKeyHash ) {
        var res;

        res = await this.#readKeyring();
        if ( !res.ok ) return res;

        if ( this.#keyring.masterKeyHash && this.#keyring.masterKeyHash !== masterKeyHash ) {
            return result( [ 500, "Maseter key is not valid" ] );
        }
        else {
            return result( 200 );
        }
    }

    async _getActiveKey () {
        const res = await this.#readKeyring();
        if ( !res.ok ) return res;

        const key = this.#keyring.keys[ this.#keyring.activeKeyId ];

        if ( key ) {
            return result( 200, { ...key } );
        }
        else {
            return result( 200 );
        }
    }

    async _getKey ( id ) {
        const res = await this.#readKeyring();
        if ( !res.ok ) return res;

        const key = this.#keyring.keys[ id ];

        if ( key ) {
            return result( 200, { ...key } );
        }
        else {
            return result( 200 );
        }
    }

    async _createKey ( encryptedKey, masterKeyHash ) {
        var res;

        res = await this.#readKeyring();
        if ( !res.ok ) return res;

        const keyring = structuredClone( this.#keyring );

        if ( !keyring.masterKeyHash ) {
            keyring.masterKeyHash = masterKeyHash;
        }
        else if ( keyring.masterKeyHash !== masterKeyHash ) {
            return result( [ 500, "Master key is revoked" ] );
        }

        var id = 0;

        for ( const _id of Object.keys( keyring.keys ) ) {
            if ( _id > id ) id = _id;
        }

        const key = {
            "id": ++id,
            "created": new Date().toISOString(),
            "revoked": null,
            "key": encryptedKey,
        };

        // revoke current key
        if ( keyring.activeKeyId ) {
            keyring.keys[ keyring.activeKeyId ].revoked = new Date();
        }

        keyring.keys[ key.id ] = key;

        keyring.activeKeyId = key.id;

        res = await this.#writeKeyring( keyring );
        if ( !res.ok ) return res;

        return result( 200, { ...key } );
    }

    async _revokeKey () {
        const res = await this.#readKeyring();
        if ( !res.ok ) return res;

        const keyring = structuredClone( this.#keyring );

        // revoke key
        if ( keyring.activeKeyId ) {
            keyring.keys[ keyring.activeKeyId ].revoked = new Date();
        }

        keyring.activeKeyId = null;

        return this.#writeKeyring( keyring );
    }

    async _reencryptKeys ( masterKey, masterKeyHash ) {
        var res;

        res = await this.#readKeyring();
        if ( !res.ok ) return res;

        const keyring = structuredClone( this.#keyring );

        try {
            for ( const key of Object.values( keyring.keys ) ) {
                res = await this._reencryptKey( key.key, masterKey );
                if ( !res.ok ) throw res;

                key.key = res.data;
            }
        }
        catch ( e ) {
            return result.catch( e );
        }

        keyring.masterKeyHash = masterKeyHash;

        return this.#writeKeyring( keyring );
    }

    // private
    async #readKeyring () {
        if ( !this.#keyring ) {
            try {
                if ( await fs.promises.stat( this.#keyringPath ).catch( e => null ) ) {
                    this.#keyring = JSON.parse( await fs.promises.readFile( this.#keyringPath ) );
                }
                else {
                    this.#keyring = {
                        "masterKeyHash": null,
                        "activeKeyId": null,
                        "keys": {},
                    };
                }
            }
            catch ( e ) {
                return result.catch( e, { "log": false } );
            }
        }

        return result( 200 );
    }

    async #writeKeyring ( keyring ) {
        try {
            await fs.promises.mkdir( path.dirname( this.#keyringPath ), {
                "recursive": true,
            } );

            await fs.promises.writeFile( this.#keyringPath, JSON.stringify( keyring ) );

            this.#keyring = keyring;

            return result( 200 );
        }
        catch ( e ) {
            return result.catch( e, { "log": false } );
        }
    }
}
