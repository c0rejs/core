import Message from "#lib/message";
import { MultipartStreamEncoder } from "#lib/stream/multipart";

export default class FormData extends MultipartStreamEncoder {
    constructor ( { type } = {} ) {
        super( type || "form-data", {
            "autoEnd": true,
        } );
    }

    // public
    append ( name, body, filename ) {
        const message = Message.new( {
            "headers": {
                "content-disposition": {
                    name,
                    filename,
                },
            },
            body,
        } );

        this.write( message );

        return this;
    }
}
