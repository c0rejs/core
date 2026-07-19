import Events from "#lib/events";
import IpRange from "#lib/ip/range";
import Ranges from "#lib/ranges";

export default class IpRanges extends Events {
    #name;
    #ranges4Index = new Map();
    #ranges4;
    #ranges6Index = new Map();
    #ranges6;
    #json;
    #string;

    constructor ( { name, ranges } = {} ) {
        super();

        this.#name = name || undefined;

        if ( ranges ) this.#add( ranges );
    }

    // properties
    get name () {
        return this.#name;
    }

    // public
    add ( ranges ) {
        const updated = this.#add( ranges );

        if ( updated ) this.#onUpdate();

        return this;
    }

    set ( ranges ) {
        ranges = this.#normalizeRanges( ranges );

        const keys = new Set( ranges.map( range => range.id ) );
        let updated = false;

        // delete v4 ranges not in new set
        for ( const key of this.#ranges4Index.keys() ) {
            if ( !keys.has( key ) ) {
                this.#ranges4Index.delete( key );
                updated = true;
            }
        }

        // delete v6 ranges not in new set
        for ( const key of this.#ranges6Index.keys() ) {
            if ( !keys.has( key ) ) {
                this.#ranges6Index.delete( key );
                updated = true;
            }
        }

        // add/update ranges
        if ( this.#add( ranges ) ) {
            updated = true;
        }

        if ( updated ) {
            this.#clearCache();
            this.#onUpdate();
        }

        return this;
    }

    delete ( ranges ) {
        const updated = this.#delete( ranges );

        if ( updated ) this.#onUpdate();

        return this;
    }

    clear () {
        const updated = this.#clear();

        if ( updated ) this.#onUpdate();

        return this;
    }

    findIntersectingRanges ( range ) {
        return this.#findRanges( IpRange.new( range ), "findIntersectingRanges" );
    }

    findCoveringRanges ( range ) {
        return this.#findRanges( IpRange.new( range ), "findCoveringRanges" );
    }

    findCoveredRanges ( range ) {
        return this.#findRanges( IpRange.new( range ), "findCoveredRanges" );
    }

    toString () {
        if ( this.#string == null ) {
            this.#string = this.toJSON().join( ", " );
        }

        return this.#string;
    }

    toJSON () {
        if ( !this.#json ) {
            const ranges = [];

            if ( this.#ranges4Index.size ) {
                ranges.push( ...[ ...this.#ranges4Index.values() ].sort( IpRange.compare ).map( range => range.toString() ) );
            }

            if ( this.#ranges6Index.size ) {
                ranges.push( ...[ ...this.#ranges6Index.values() ].sort( IpRange.compare ).map( range => range.toString() ) );
            }

            this.#json = ranges;
        }

        return this.#json;
    }

    [ Symbol.iterator ] () {
        return this.toJSON()[ Symbol.iterator ]();
    }

    // private
    #normalizeRanges ( ranges ) {
        if ( typeof ranges === "string" ) {
            ranges = ranges.split( "," ).map( range => range.trim() );
        }
        else if ( !Array.isArray( ranges ) ) {
            ranges = [ ranges ];
        }

        return ranges.filter( range => range ).map( range => IpRange.new( range ) );
    }

    #getRanges4 () {
        if ( !this.#ranges4 ) {
            const ranges = Array.from( this.#ranges4Index.values(), range => range.range );

            this.#ranges4 = new Ranges( ranges );
        }

        return this.#ranges4;
    }

    #getRanges6 () {
        if ( !this.#ranges6 ) {
            const ranges = Array.from( this.#ranges6Index.values(), range => range.range );

            this.#ranges6 = new Ranges( ranges );
        }

        return this.#ranges6;
    }

    #add ( ranges ) {
        ranges = this.#normalizeRanges( ranges );

        let updated = false;

        for ( const range of ranges ) {
            if ( range.isIpV4 ) {
                if ( !this.#ranges4Index.has( range.id ) ) {
                    this.#ranges4Index.set( range.id, range );
                    updated = true;
                }
            }
            else {
                if ( !this.#ranges6Index.has( range.id ) ) {
                    this.#ranges6Index.set( range.id, range );
                    updated = true;
                }
            }
        }

        if ( updated ) this.#clearCache();

        return updated;
    }

    #delete ( ranges ) {
        ranges = this.#normalizeRanges( ranges );

        let updated = false;

        for ( const range of ranges ) {
            if ( range.isIpV4 ) {
                if ( this.#ranges4Index.has( range.id ) ) {
                    this.#ranges4Index.delete( range.id );
                    updated = true;
                }
            }
            else {
                if ( this.#ranges6Index.has( range.id ) ) {
                    this.#ranges6Index.delete( range.id );
                    updated = true;
                }
            }
        }

        if ( updated ) this.#clearCache();

        return updated;
    }

    #clear () {
        let updated = false;

        if ( this.#ranges4Index.size ) {
            this.#ranges4Index.clear();
            updated = true;
        }

        if ( this.#ranges6Index.size ) {
            this.#ranges6Index.clear();
            updated = true;
        }

        if ( updated ) this.#clearCache();

        return updated;
    }

    #clearCache () {
        this.#ranges4 = null;
        this.#ranges6 = null;
        this.#json = null;
        this.#string = null;
    }

    #onUpdate () {
        this.emit( "update" );
    }

    #findRanges ( range, methodName ) {
        const isIpV4 = range.isIpV4,
            index = isIpV4
                ? this.#ranges4Index
                : this.#ranges6Index,
            ranges = isIpV4
                ? this.#getRanges4()
                : this.#getRanges6();

        return ranges[ methodName ]( range.range ).map( r => index.get( r.name ) );
    }
}
