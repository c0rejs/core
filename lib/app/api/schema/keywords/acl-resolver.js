const keyword = {
    "keyword": "aclResolver",
    "type": [ "string", "number" ],
    "metaSchema": {
        "type": "string",
    },
    compile ( schema ) {
        if ( !schema ) return;

        aclResolverKeyword.addAclResolverSchema( schema );

        return data => {
            aclResolverKeyword.addAclResolver( {
                "id": data,
                "resolver": schema,
            } );

            return true;
        };
    },
};

class AclResolverKeyword {
    #aclResolverSchemas;
    #aclResolvers;

    // properties
    get keyword () {
        return keyword;
    }

    get aclResolverSchemas () {
        return this.#aclResolverSchemas;
    }

    get aclResolvers () {
        return this.#aclResolvers;
    }

    // public
    addAclRecolverSchema ( schema ) {
        this.#aclResolverSchemas.add( schema );
    }

    clearAclResolverSchemas () {
        this.#aclResolverSchemas = new Set();
    }

    addAclResolver ( aclResolver ) {
        this.#aclResolvers ??= [];

        this.#aclResolvers.push( aclResolver );
    }

    clearAclResolvers () {
        this.#aclResolvers = null;
    }
}

const aclResolverKeyword = new AclResolverKeyword();

export default aclResolverKeyword;
