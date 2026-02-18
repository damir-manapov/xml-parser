import type { ReadStream } from "node:fs";
import type { Readable } from "node:stream";
import type { validationOptions as ValidationOptions } from "fast-xml-parser";

export interface ParseReadStream<T = Record<string, string>> {
  on: (
    event: "data",
    listener: (parseXmlData: T[] | null) => Promise<void>,
  ) => void;
}

export interface IXmlParser {
  parse<T = Record<string, unknown>>(
    data: Buffer,
    validationOptions?: ValidationOptions | boolean,
  ): T;

  createParseReadStream<T = Record<string, string>>(
    stream: Readable,
    rowTag: string,
    validationOptions?: ValidationOptions | boolean,
  ): ParseReadStream<T>;
}

export interface IXmlZipParser extends IXmlParser {
  parseFromZip<T = Record<string, unknown>>(
    data: Buffer,
    validationOptions?: ValidationOptions | boolean,
  ): Array<{ name: string; parsedData: T }>;

  createParseReadStreamsGetterFromZip<T = Record<string, string>>(
    data: ReadStream,
    rowTag: string,
    validationOptions?: ValidationOptions | boolean,
  ): AsyncGenerator<{ name: string; stream: ParseReadStream<T> }>;
}
