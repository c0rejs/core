import DigitalSize from "#lib/digital-size";
import Message from "#lib/message";

const keyword = {
    "keyword": "attachment",
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

        if ( maxContentLength <= 0 ) throw new Error( "Attachment maxContentLength must be positive integer" );

        if ( global[ Symbol.for( "ajvAttachmentMaxContentLength" ) ] == null ) {
            global[ Symbol.for( "ajvAttachmentMaxContentLength" ) ] = maxContentLength;
        }
        else if ( maxContentLength > global[ Symbol.for( "ajvAttachmentMaxContentLength" ) ] ) {
            global[ Symbol.for( "ajvAttachmentMaxContentLength" ) ] = maxContentLength;
        }

        return function validator ( attachment ) {
            validator.errors = [];

            if ( attachment instanceof Message ) {

                // check content length
                if ( !attachment.contentLength || attachment.contentLength > maxContentLength ) {
                    validator.errors.push( {
                        "keyword": "attachment",
                        "message": `Attachment is too large. Maximum allowed attachment content length is ${ maxContentLength } byte(s)`,
                    } );
                }

                // check content type
                if ( contentType && ( !attachment.contentType || !contentType.has( attachment.headers.get( "content-type" ).type ) ) ) {
                    validator.errors.push( {
                        "keyword": "attachment",
                        "message": "Attachment content type is invalid",
                    } );
                }
            }
            else {
                validator.errors.push( {
                    "keyword": "attachment",
                    "message": "Not a attachment object",
                } );
            }
        };
    },
};

class AttachmentKeyword {
    get keyword () {
        return keyword;
    }

    async getDescription ( param ) {
        var desc = "{Attachment}" + ( param.description
            ? " " + param.description.trim()
            : "" ) + ` Maximim attachment content length: \`${ new Intl.NumberFormat( "en-US" ).format( param.schema.attachment.maxContentLength ) }\` bytes.`;

        if ( param.schema.attachment.contentType ) {
            const types = new Set( Array.isArray( param.schema.attachment.contentType )
                ? param.schema.attachment.contentType
                : [ param.schema.attachment.contentType ] );

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

export default new AttachmentKeyword();
