import { MultipartStreamEncoder } from "#lib/stream/multipart";

export default class FormData extends MultipartStreamEncoder {
    constructor ( { type } = {} ) {
        super( type || "form-data", {
            "autoEnd": true,
        } );
    }

    // public
    append ( name, body, filename ) {
        this.write( {
            "headers": {
                "content-disposition": {
                    name,
                    filename,
                },
            },
            body,
        } );

        return this;
    }
}
