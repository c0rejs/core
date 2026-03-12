import DigitalSize from "#lib/digital-size";
import Message from "#lib/message";

const keyword = {
    "keyword": "message",
    "metaSchema": {
        "type": "object",
        "properties": {
            "maxContentLength": {
                "type": "string",
                "format": "digital-size",
            },
            "contentType": {
                "anyOf": [
                    {
                        "type": "string",
                    },
                    {
                        "type": "array",
                        "items": { "type": "string" },
                        "minItems": 1,
                        "uniqueItems": true,
                    },
                ],
            },
        },
        "additionalProperties": false,
        "required": [ "maxContentLength" ],
    },
    "errors": true,
    compile ( schema, parentSchema ) {
        const maxContentLength = DigitalSize.new( schema.maxContentLength ).bytes,
            contentType = schema.contentType
                ? new Set( Array.isArray( schema.contentType )
                    ? schema.contentType
                    : [ schema.contentType ] )
                : null;

        if ( maxContentLength <= 0 ) throw new Error( "Message maxContentLength must be positive integer" );

        global[ Symbol.for( "ajvMessageKeyword" ) ] ||= maxContentLength;
        if ( global[ Symbol.for( "ajvMessageKeyword" ) ] < maxContentLength ) global[ Symbol.for( "ajvMessageKeyword" ) ] = maxContentLength;

        return function validator ( message ) {
            validator.errors = [];

            if ( message instanceof Message ) {

                // check content length
                if ( !message.contentLength || message.contentLength > maxContentLength ) {
                    validator.errors.push( {
                        "keyword": "message",
                        "message": `Message is too large. Maximum allowed message content length is ${ maxContentLength } byte(s)`,
                    } );
                }

                // check content type
                if ( contentType && ( !message.contentType || !contentType.has( message.headers.get( "content-type" ).type ) ) ) {
                    validator.errors.push( {
                        "keyword": "message",
                        "message": "Content type is invalid",
                    } );
                }
            }
            else {
                validator.errors.push( {
                    "keyword": "message",
                    "message": "Not a Message object",
                } );
            }
        };
    },
};

class MessageKeyword {
    get keyword () {
        return keyword;
    }

    async getDescription ( param ) {
        var desc = "{Message}" + ( param.description
            ? " " + param.description.trim()
            : "" ) + ` Maximim message content length: \`${ new Intl.NumberFormat( "en-US" ).format( param.schema.message.maxContentLength ) }\` bytes.`;

        if ( param.schema.message.contentType ) {
            const types = new Set( Array.isArray( param.schema.message.contentType )
                ? param.schema.message.contentType
                : [ param.schema.message.contentType ] );

            desc +=
                " Allowed content types: " +
                [ ...types ]
                    .sort()
                    .map( type => `\`"${ type }"\`` )
                    .join( ", " ) +
                ".";
        }

        return desc;
    }
}

export default new MessageKeyword();
