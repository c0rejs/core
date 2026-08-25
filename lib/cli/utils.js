import ansi from "#lib/ansi";

export function prepareHeader ( header ) {
    const disposableStack = new DisposableStack();
    disposableStack.use( ansi.pushEnabled( process.stdout.isTTY ) );

    header = ansi.bold.underline( header + ":" );

    return header;
}
