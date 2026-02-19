import AuthorizationHeader from "#lib/http/headers/header/authorization";

const NAME = "proxy-authorization";

export default class ProxyAuthorizationHeader extends AuthorizationHeader {

    // static
    static get headerName () {
        return NAME;
    }
}
