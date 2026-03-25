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

    // public
    addAclResolverSchema ( schema ) {
        this.#aclResolverSchemas.add( schema );
    }

    clearAclResolverSchemas () {
        const data = this.#aclResolverSchemas;

        this.#aclResolverSchemas = new Set();

        return data;
    }

    addAclResolver ( aclResolver ) {
        this.#aclResolvers ??= [];

        this.#aclResolvers.push( aclResolver );
    }

    clearAclResolvers () {
        const data = this.#aclResolvers;

        this.#aclResolvers = null;

        return data;
    }
}

const aclResolverKeyword = new AclResolverKeyword();

export default aclResolverKeyword;
