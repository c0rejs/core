#!/usr/bin/env node

import { deepStrictEqual } from "node:assert";
import { suite, test } from "node:test";
import { Readable } from "#lib/stream";
import { sleep } from "#lib/utils";

const buffer = "12-34--56--78-90",
    encoding = "utf8",
    chunkSizes = [ null, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10 ],
    eols = [ "-", "--", "---" ],
    maxLengths = [ null, 1, 2, 3, 4, 5, 6 ],
    lastEols = [ true, false ];

suite( "stream", () => {

    // read line
    suite( "readline", () => {
        for ( const chunkSize of chunkSizes ) {
            for ( const eol of eols ) {
                for ( const maxLength of maxLengths ) {
                    for ( const lastEolRequired of lastEols ) {
                        for ( const addLastEol of lastEols ) {
                            test( `${ chunkSize }_${ eol }_${ maxLength }_${ lastEolRequired }_${ addLastEol }`, async () => {
                                const dataBuffer = addLastEol
                                        ? buffer + eol
                                        : buffer,
                                    data = {
                                        "buffer": dataBuffer,
                                        chunkSize,
                                        eol,
                                        maxLength,
                                        lastEolRequired,
                                    },
                                    expected = [],
                                    lines = dataBuffer.split( eol );

                                for ( const line of lines ) {
                                    if ( maxLength && line.length > maxLength ) {
                                        break;
                                    }
                                    else {
                                        expected.push( line );
                                    }
                                }

                                // has last eol
                                if ( expected.at( -1 ) === "" ) {
                                    expected.pop();
                                }

                                // has no last eol
                                else {
                                    if ( lastEolRequired ) {
                                        expected.pop();
                                    }
                                }

                                expected.push( undefined );

                                const actual = await readLine( data );

                                try {
                                    deepStrictEqual( actual, expected );
                                }
                                catch ( e ) {
                                    console.log( "data:    ", data );
                                    console.log( "expected:", expected );
                                    console.log( "actial:  ", actual );
                                    process.exit();

                                    throw e;
                                }
                            } );
                        }
                    }
                }
            }
        }
    } );

    // read chunk
    suite( "readchunk", () => {
        for ( const chunkSize of chunkSizes ) {
            for ( let length = 1; length <= buffer.length; length++ ) {
                for ( const maxLength of maxLengths ) {
                    test( `${ chunkSize }_${ length }_${ maxLength }`, async () => {
                        const data = {
                                buffer,
                                length,
                                maxLength,
                                chunkSize,
                            },
                            expected = [];

                        var dataBuffer = buffer;

                        while ( true ) {
                            const chunk = dataBuffer.slice( 0, length );

                            if ( chunk.length < length ) {
                                break;
                            }
                            else if ( maxLength && chunk.length > maxLengths ) {
                                break;
                            }
                            else {
                                expected.push( chunk );

                                dataBuffer = dataBuffer.slice( chunk.length );
                            }
                        }

                        expected.push( undefined );

                        const actual = await readChunk( data );

                        // eslint-disable-next-line no-useless-catch
                        try {
                            deepStrictEqual( actual, expected );
                        }
                        catch ( e ) {

                            // console.log( "data:    ", data );
                            // console.log( "expected:", expected );
                            // console.log( "actial:  ", actual );
                            // process.exit();

                            throw e;
                        }
                    } );
                }
            }
        }
    } );
} );

async function readLine ( data ) {
    const stream = createReadStream( data );

    const actual = [];

    while ( true ) {
        const line = await stream.readLine( {
            "eol": data.eol,
            encoding,
            "maxLength": data.maxLength,
            "lastEolRequired": data.lastEolRequired,
        } );

        actual.push( line );

        if ( line === undefined ) break;
    }

    return actual;
}

async function readChunk ( data ) {
    const stream = createReadStream( data );

    const actual = [];

    while ( true ) {
        const line = await stream.readChunk( data.length, {
            encoding,
            "maxLength": data.maxLength,
        } );

        actual.push( line );

        if ( line === undefined ) break;
    }

    return actual;
}

function createReadStream ( { buffer, chunkSize } ) {
    return new Readable( {
        async read () {
            await sleep( 1 );

            const data = buffer.slice( 0, chunkSize || undefined );

            if ( data.length ) {
                buffer = buffer.slice( data.length );

                this.push( data, encoding );
            }
            else {
                this.push( null );
            }
        },
    } );
}
