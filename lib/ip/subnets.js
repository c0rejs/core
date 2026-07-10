import { readConfigSync } from "#lib/config";
import Events from "#lib/events";
import externalResources from "#lib/external-resources";
import IpRanges from "#lib/ip/ranges";

class IpSubnets extends Events {
    #subnets = new Map();
    #subnetsUpdateListeners = {};

    // properties
    get size () {
        return this.#subnets.size;
    }

    // public
    has ( name ) {
        return this.#subnets.has( name );
    }

    get ( name ) {
        return this.#subnets[ name ];
    }

    add ( name, ranges ) {
        var subnet = this.#subnets.get( name );

        if ( !subnet ) {
            subnet = new IpRanges( ranges );

            this.#subnets.set( name, subnet );

            subnet.on( "update", ( this.#subnetsUpdateListeners[ name ] = this.#onSubnetUpdate.bind( this, name ) ) );

            this.emit( "add", name );
        }
        else {
            subnet.add( ranges );
        }

        return this;
    }

    set ( name, ranges ) {
        const subnet = this.#subnets.get( name );

        if ( subnet ) {
            subnet.set( ranges );
        }
        else {
            this.add( name, ranges );
        }

        return this;
    }

    delete ( name ) {
        const subnet = this.#subnets.get( name );

        if ( subnet ) {
            this.#subnets.delete( name );

            subnet.off( "update", this.#subnetsUpdateListeners[ name ] );

            delete this.#subnetsUpdateListeners[ name ];

            this.emit( "delete", name );
        }

        return this;
    }

    [ Symbol.iterator ] () {
        return this.#subnets.values();
    }

    // private
    #onSubnetUpdate ( name ) {
        this.emit( "update", name );
    }
}

const subnets = new IpSubnets();

export default subnets;

const resource = await externalResources.add( "corejslib/core/resources/subnets" ).on( "update", loadResources ).check();

loadResources();

function loadResources () {
    const data = readConfigSync( resource.getResourcePath( "subnets.json" ) );

    for ( const name in data ) {
        subnets.set( name, data[ name ] );
    }
}
