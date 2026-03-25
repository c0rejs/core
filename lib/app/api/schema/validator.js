import Ajv from "#lib/ajv";
import { readConfig } from "#lib/config";
import aclResolverKeyword from "./keywords/acl-resolver.js";
import attachmentKeyword from "./keywords/attachment.js";
import readKeyword from "./keywords/read.js";

export const schemaValidator = new Ajv().addSchema( await readConfig( "#resources/schemas/api.schema.yaml", {
    "resolve": import.meta.url,
} ) );

export function buildParamsValidator ( paramsSchema, strictTuples ) {
    return new Ajv( {
        "strictTuples": Boolean( strictTuples ),
    } )
        .addKeyword( readKeyword.keyword )
        .addKeyword( attachmentKeyword.keyword )
        .addKeyword( aclResolverKeyword.keyword )
        .compile( paramsSchema );
}
