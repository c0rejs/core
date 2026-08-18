import GlobPattern from "#lib/glob/pattern";

export function normalizeName ( name ) {
    return name.toLowerCase();
}

export function normalizeExtname ( name ) {
    name = name.toLowerCase();

    if ( !name.startsWith( "." ) ) {
        name = "." + name;
    }

    return name;
}

export function createPattern ( pattern ) {
    return GlobPattern.new( pattern, {
        "caseSensitive": false,
        "allowNegatedPatterns": false,
        "allowBraces": false,
        "allowBrackets": true,
        "allowGlobstar": false,
        "allowExtglob": true,
        "allowGlobalBasename": true,
    } );
}
