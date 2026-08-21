import XmlParser from "@nodable/flexible-xml-parser";
import XmlBuilder from "fast-xml-builder";

// DOCS: https://github.com/nodable/flexible-xml-parser
export function fromXml ( xml, options ) {
    const parser = new XmlParser( options );

    return parser.parse( xml );
}

// DOCS: https://github.com/NaturalIntelligence/fast-xml-builder
export function toXml ( data, options ) {
    const builder = new XmlBuilder( options );

    return builder.build( data );
}
