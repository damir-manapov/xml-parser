import type { ReadStream } from "node:fs";
import { extname } from "node:path";
import type { validationOptions as ValidationOptions } from "fast-xml-parser";
import type { IXmlZipParser } from "./types.js";
import XmlParser from "./XmlParser.js";
import ZipParser from "./ZipParser.js";

const XML_EXTENSION = ".xml";

class XmlZipParser extends XmlParser implements IXmlZipParser {
  public parseFromZip(
    data: Buffer,
    validationOptions?: ValidationOptions | boolean,
  ) {
    const entries = ZipParser.getEntries(data);

    const xmlEntries = entries.filter(
      (entry) => extname(entry.name) === XML_EXTENSION,
    );

    return xmlEntries.map((xmlEntry) => ({
      name: xmlEntry.name,
      parsedData: this.parse(xmlEntry.data, validationOptions),
    }));
  }

  public static async *createReadStreamsGetterFromZip(data: ReadStream) {
    const entries = ZipParser.createReadStreamsGetterFromEntries(data);

    for await (const entry of entries) {
      if (extname(entry.name) === XML_EXTENSION) {
        yield entry;
      } else {
        entry.stream.autodrain();
      }
    }
  }

  public async *createParseReadStreamsGetterFromZip<T = Record<string, string>>(
    data: ReadStream,
    rowTag: string,
    validationOptions?: ValidationOptions | boolean,
  ) {
    const xmlEntries = XmlZipParser.createReadStreamsGetterFromZip(data);

    for await (const entry of xmlEntries) {
      yield {
        name: entry.name,
        stream: this.createParseReadStream<T>(
          entry.stream,
          rowTag,
          validationOptions,
        ),
      };
    }
  }
}

export default XmlZipParser;
