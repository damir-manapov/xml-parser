import { type Readable, Transform } from "node:stream";
import {
  type validationOptions as ValidationOptions,
  XMLParser,
} from "fast-xml-parser";
import type { IXmlParser } from "./types.js";

const allVariationsOfSpaces = /(?:\s|&nbsp;)+/;
const tabulationsCarriageReturnsAndEscapes = /[\t\n\r]/;
const notUsedUnicodeStringCodes = /[\u0002\u0003\u200B\u202A\u202B]/;

class XmlParser implements IXmlParser {
  protected parser: XMLParser;

  constructor(options?: { alwaysArray?: boolean }) {
    this.parser = new XMLParser({
      trimValues: true,
      numberParseOptions: {
        skipLike: /\d/mu,
        hex: true,
        leadingZeros: true,
      },
      ignoreAttributes: false,
      attributeNamePrefix: "$",
      transformTagName: (tagName) => tagName.toUpperCase(),
      ...(options?.alwaysArray && {
        isArray: (
          _name: string,
          jpath: string,
          _isLeaf: boolean,
          isAttribute: boolean | undefined,
        ) => isAttribute === undefined && jpath.includes("."),
      }),
      attributeValueProcessor(_attrName, attrValue) {
        if (attrValue === "null") {
          return "";
        }

        return attrValue
          .replaceAll(new RegExp(allVariationsOfSpaces, "gu"), " ")
          .replaceAll(
            new RegExp(tabulationsCarriageReturnsAndEscapes, "gu"),
            " ",
          )
          .replaceAll(new RegExp(notUsedUnicodeStringCodes, "gu"), "")
          .trim();
      },
    });
  }

  private static prepareFileContent(content: string) {
    return content.replaceAll("><<", ">&lt;<").replaceAll(">&<", ">&#38;<");
  }

  public parse(data: Buffer, validationOptions?: ValidationOptions | boolean) {
    const prepared = XmlParser.prepareFileContent(data.toString());

    return this.parser.parse(prepared, validationOptions);
  }

  public createParseReadStream<T = Record<string, string>>(
    stream: Readable,
    rowTag: string,
    validationOptions?: ValidationOptions | boolean,
  ) {
    const tagRegex = new RegExp(`<${rowTag} (\n|.)*>`, "gu");

    return {
      on: (
        _event: "data",
        listener: (parseXmlData: T[] | null) => Promise<void>,
      ) => {
        let remainingXmlData = "";

        const dataTransform = new Transform({
          transform: async (chunk, _encoding, next) => {
            const chunkString = remainingXmlData + chunk;

            const tags = chunkString.match(tagRegex);

            if (!tags) {
              await listener(null);

              return next();
            }

            const xmlData = XmlParser.prepareFileContent(tags.join("\n"));

            const result = this.parser.parse(
              `<DATA>${xmlData}</DATA>`,
              validationOptions,
            );

            remainingXmlData = chunkString.replaceAll(tagRegex, "");

            await listener(
              Array.isArray(result.DATA[rowTag.toUpperCase()])
                ? result.DATA[rowTag.toUpperCase()]
                : [result.DATA[rowTag.toUpperCase()]],
            );

            return next();
          },
        });

        stream.pipe(dataTransform);
      },
    };
  }
}

export default XmlParser;
