import fs from "node:fs";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import Blob from "#lib/blob";
import File from "#lib/file";
import Counter from "#lib/threads/counter";
import { objectIsPlain } from "#lib/utils";

export default class FileTree {
    #files = new Map();

    // properties
    get size () {
        return this.#files.size;
    }

    get isEmpty () {
        return !this.#files.size;
    }

    // public
    has ( path ) {
        return this.#files.has( path );
    }

    get ( path ) {
        return this.#files.get( path );
    }

    delete ( path ) {
        delete this.#files.delete( path );
    }

    add ( source ) {
        var path;

        if ( objectIsPlain( source ) ) {
            path = source.path;
            source = source.source;
        }

        if ( !path && source instanceof File ) {
            path = source.path;
        }

        if ( !path ) throw new Error( "Path is required" );

        if ( !( source instanceof Blob ) ) throw new Error( "Source must be instance of Blob" );

        this.#files.set( path, source );

        return this;
    }

    async write ( dirname ) {
        var error;

        dirname = path.resolve( dirname );

        const counter = new Counter();

        for ( const [ path, source ] of this ) {
            counter.value++;

            this.#writeFile( dirname, path, source )
                .catch( e => ( error = e ) )
                .finally( () => counter.value-- );
        }

        await counter.wait();

        if ( error ) throw error;
    }

    keys () {
        return this.#files.keys();
    }

    values () {
        return this.#files.values();
    }

    entries () {
        return this.#files.entries();
    }

    [ Symbol.iterator ] () {
        return this.entries();
    }

    // private
    async #writeFile ( dirname, filePath, source ) {
        const fullPath = path.join( dirname, filePath ),
            targetDirname = path.dirname( fullPath );

        await fs.promises.mkdir( targetDirname, {
            "recursive": true,
        } );

        return pipeline( source.stream(), fs.createWriteStream( fullPath ) );
    }
}
