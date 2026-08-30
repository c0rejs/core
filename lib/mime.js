import { readConfig } from "#lib/config";
import externalResources from "#lib/external-resources";
import Mime from "#lib/mime/mime";

const resource = await externalResources
    .add( "corejslib/core/resources/mime", {
        "autoUpdate": false,
    } )
    .check();

export default new Mime().add( await readConfig( resource.getResourcePath( "mime.json" ) ) );
